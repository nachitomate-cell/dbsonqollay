// SonqollaySync — plugin de Navisworks 2026 que trae los datos editados en la
// web Sonqollay y los escribe como propiedades custom en los elementos del
// modelo, vinculando por TAG.
//
// Al ejecutarlo, lista las planillas publicadas (GET /api/datasets) y te deja
// ELEGIR cuáles sincronizar (una, varias o todas). NO hay que recompilar para
// cambiar de planilla.
//
// SIN dependencias externas (NuGet): WebClient + JavaScriptSerializer, ambos del
// .NET Framework 4.8. Compilar con SonqollaySync.csproj (net48 / x64).
// Ver README.md para instalación y configuración.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Net;
using System.Web.Script.Serialization; // System.Web.Extensions (framework)
using System.Windows.Forms;

using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Plugins;

// COM API (para ESCRIBIR propiedades; el API .NET es de solo lectura)
using ComApi = Autodesk.Navisworks.Api.Interop.ComApi;
using ComApiBridge = Autodesk.Navisworks.Api.ComApi.ComApiBridge;

namespace Sonqollay
{
    [Plugin("Sonqollay.Sync", "SQY",
            DisplayName = "Sonqollay Sync",
            ToolTip = "Trae los datos editados en Sonqollay y los escribe en el modelo")]
    public class SonqollaySync : AddInPlugin
    {
        // ----- CONFIGURACIÓN (editar una sola vez) ------------------------
        private const string BaseUrl      = "https://basesonqollay.synaptechspa.cl";
        private const string ApiToken     = "PEGAR_EL_MISMO_SQY_API_TOKEN";
        // Propiedad del modelo que contiene el TAG (en tus DWG suele ser la capa).
        private const string LinkProperty = "Layer";
        // Pestaña de propiedades custom que se agrega a los elementos.
        private const string TabName      = "Sonqollay";
        // NOTA: la planilla (DatasetKey) NO se configura acá: se elige al correr.
        // ------------------------------------------------------------------

        public override int Execute(params string[] parameters)
        {
            // Vercel exige TLS 1.2+. En net48 suele estar por defecto, pero lo
            // forzamos para evitar errores de handshake en máquinas viejas.
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            if (doc == null || doc.Models.Count == 0)
            {
                MessageBox.Show("Abrí primero un modelo en Navisworks.");
                return 0;
            }

            // 1) Listar las planillas publicadas.
            List<DatasetInfo> index;
            try
            {
                index = FetchIndex();
            }
            catch (Exception ex)
            {
                MessageBox.Show("No se pudo obtener la lista de planillas:\n" + ex.Message);
                return 0;
            }
            if (index.Count == 0)
            {
                MessageBox.Show("No hay planillas publicadas todavía.\n\n" +
                                "En la web Sonqollay, abrí cada planilla y apretá \"Publicar para Navisworks\".");
                return 0;
            }

            // 2) Elegir cuáles sincronizar.
            List<DatasetInfo> chosen = ShowPicker(index);
            if (chosen.Count == 0) return 0; // canceló o no marcó ninguna

            // 3) Aplicar cada una.
            int totalRows = 0, totalMatched = 0, totalApplied = 0, totalMissing = 0;
            var errores = new List<string>();
            foreach (var info in chosen)
            {
                try
                {
                    Dataset data = FetchDataset(info.key);
                    var res = ApplyDataset(doc, data);
                    totalRows += data.rows.Count;
                    totalMatched += res.matched;
                    totalApplied += res.applied;
                    totalMissing += res.missing;
                }
                catch (Exception ex)
                {
                    errores.Add(info.name + ": " + ex.Message);
                }
            }

            string msg =
                "Sonqollay Sync\n\n" +
                "Planillas: " + chosen.Count + "\n" +
                "Filas: " + totalRows + "\n" +
                "TAGs encontrados: " + totalMatched + "\n" +
                "Elementos actualizados: " + totalApplied + "\n" +
                "TAGs sin geometría: " + totalMissing + "\n\n" +
                "Guardá el archivo (.nwf/.nwd) para conservar las propiedades.";
            if (errores.Count > 0)
                msg += "\n\nErrores:\n - " + string.Join("\n - ", errores);
            MessageBox.Show(msg);
            return 0;
        }

        // ---- Aplicar un dataset al modelo --------------------------------
        private struct ApplyResult { public int matched, applied, missing; }

        private ApplyResult ApplyDataset(Document doc, Dataset data)
        {
            string tagField = !string.IsNullOrEmpty(data.tagField)
                ? data.tagField
                : (data.headers.Count > 0 ? data.headers[0] : null);
            var res = new ApplyResult();
            if (string.IsNullOrEmpty(tagField)) return res;

            foreach (var row in data.rows)
            {
                string tag;
                if (!row.TryGetValue(tagField, out tag) || string.IsNullOrWhiteSpace(tag))
                    continue;

                ModelItemCollection items = FindByTag(doc, tag);
                if (items.Count == 0) { res.missing++; continue; }
                res.matched++;

                WriteCustomTab(items, row, tagField);
                res.applied += items.Count;
            }
            return res;
        }

        // ---- HTTP --------------------------------------------------------
        private string HttpGet(string url)
        {
            using (var wc = new WebClient())
            {
                wc.Encoding = System.Text.Encoding.UTF8;
                if (!string.IsNullOrEmpty(ApiToken))
                    wc.Headers[HttpRequestHeader.Authorization] = "Bearer " + ApiToken;
                try
                {
                    return wc.DownloadString(url);
                }
                catch (WebException wex)
                {
                    string body = "";
                    if (wex.Response != null)
                        using (var sr = new System.IO.StreamReader(wex.Response.GetResponseStream()))
                            body = sr.ReadToEnd();
                    throw new Exception(wex.Message + (body.Length > 0 ? "\n" + body : ""));
                }
            }
        }

        // Lista de planillas publicadas: GET /api/datasets -> { datasets: [...] }
        private List<DatasetInfo> FetchIndex()
        {
            string json = HttpGet(BaseUrl.TrimEnd('/') + "/api/datasets");
            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = ser.DeserializeObject(json) as Dictionary<string, object>;
            var list = new List<DatasetInfo>();
            if (root != null && root.ContainsKey("datasets") && root["datasets"] is object[] arr)
            {
                foreach (var item in arr)
                {
                    if (item is Dictionary<string, object> o)
                    {
                        list.Add(new DatasetInfo
                        {
                            key = o.ContainsKey("key") ? Convert.ToString(o["key"]) : "",
                            name = o.ContainsKey("name") ? Convert.ToString(o["name"]) : "",
                            count = o.ContainsKey("count") ? Convert.ToInt32(o["count"]) : 0,
                        });
                    }
                }
            }
            return list.Where(d => !string.IsNullOrEmpty(d.key)).ToList();
        }

        // Un dataset puntual: GET /api/datasets/:key
        private Dataset FetchDataset(string key)
        {
            string json = HttpGet(BaseUrl.TrimEnd('/') + "/api/datasets/" + Uri.EscapeDataString(key));
            return ParseDataset(json);
        }

        private Dataset ParseDataset(string json)
        {
            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = ser.DeserializeObject(json) as Dictionary<string, object>;
            var ds = new Dataset
            {
                name = root != null && root.ContainsKey("name") ? Convert.ToString(root["name"]) : "",
                tagField = root != null && root.ContainsKey("tagField") ? Convert.ToString(root["tagField"]) : null,
                headers = new List<string>(),
                rows = new List<Dictionary<string, string>>(),
            };
            if (root == null) return ds;

            if (root.ContainsKey("headers") && root["headers"] is object[] hs)
                foreach (var h in hs) ds.headers.Add(Convert.ToString(h));

            if (root.ContainsKey("rows") && root["rows"] is object[] rows)
            {
                foreach (var item in rows)
                {
                    if (item is Dictionary<string, object> obj)
                    {
                        var dict = new Dictionary<string, string>();
                        foreach (var kv in obj)
                            dict[kv.Key] = kv.Value == null ? "" : Convert.ToString(kv.Value);
                        ds.rows.Add(dict);
                    }
                }
            }
            return ds;
        }

        // ---- UI: elegir planillas ----------------------------------------
        private static List<DatasetInfo> ShowPicker(List<DatasetInfo> all)
        {
            var form = new Form
            {
                Text = "Sonqollay — elegí las planillas a sincronizar",
                ClientSize = new Size(460, 380),
                StartPosition = FormStartPosition.CenterScreen,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MinimizeBox = false,
                MaximizeBox = false,
            };
            var clb = new CheckedListBox
            {
                Left = 12, Top = 12, Width = 436, Height = 300,
                CheckOnClick = true,
                IntegralHeight = false,
            };
            foreach (var d in all) clb.Items.Add(d, true); // todas marcadas por defecto

            var ok = new Button { Text = "Sincronizar", Left = 268, Top = 324, Width = 90, Height = 30, DialogResult = DialogResult.OK };
            var cancel = new Button { Text = "Cancelar", Left = 364, Top = 324, Width = 84, Height = 30, DialogResult = DialogResult.Cancel };
            form.Controls.Add(clb);
            form.Controls.Add(ok);
            form.Controls.Add(cancel);
            form.AcceptButton = ok;
            form.CancelButton = cancel;

            if (form.ShowDialog() != DialogResult.OK) return new List<DatasetInfo>();
            return clb.CheckedItems.Cast<DatasetInfo>().ToList();
        }

        // ---- Matchear por TAG --------------------------------------------
        private ModelItemCollection FindByTag(Document doc, string tag)
        {
            var search = new Search();
            search.Selection.SelectAll();
            search.Locations = SearchLocations.DescendantsAndSelf;
            search.SearchConditions.Add(
                SearchCondition.HasPropertyByDisplayName("Item", LinkProperty)
                               .EqualValue(VariantData.FromDisplayString(tag)));
            var found = search.FindAll(doc, false);
            if (found.Count > 0) return found;

            var s2 = new Search();
            s2.Selection.SelectAll();
            s2.Locations = SearchLocations.DescendantsAndSelf;
            s2.SearchConditions.Add(
                SearchCondition.HasPropertyByDisplayName("Item", "Name")
                               .EqualValue(VariantData.FromDisplayString(tag)));
            return s2.FindAll(doc, false);
        }

        // ---- Escribir propiedades custom (COM API) -----------------------
        // En el SDK de Navisworks, SetUserDefined va por cada elemento, sobre su
        // nodo de propiedades (InwGUIPropertyNode2), no sobre el estado global.
        private void WriteCustomTab(ModelItemCollection items, Dictionary<string, string> row, string tagField)
        {
            ComApi.InwOpState10 state = ComApiBridge.State;
            ComApi.InwOpSelection comSel = ComApiBridge.ToInwOpSelection(items);

            foreach (ComApi.InwOaPath path in comSel.Paths())
            {
                // Nodo de propiedades del elemento (true = crear si no existe).
                ComApi.InwGUIPropertyNode2 node =
                    (ComApi.InwGUIPropertyNode2)state.GetGUIPropertyNode(path, true);

                ComApi.InwOaPropertyVec vec = (ComApi.InwOaPropertyVec)state.ObjectFactory(
                    ComApi.nwEObjectType.eObjectType_nwOaPropertyVec, null, null);

                foreach (var kv in row)
                {
                    if (kv.Key == tagField) continue;
                    ComApi.InwOaProperty p = (ComApi.InwOaProperty)state.ObjectFactory(
                        ComApi.nwEObjectType.eObjectType_nwOaProperty, null, null);
                    p.name = Sanitize(kv.Key);   // nombre interno
                    p.UserName = kv.Key;          // nombre visible
                    p.value = kv.Value ?? "";
                    vec.Properties().Add(p);
                }

                // Agrega/reemplaza la pestaña custom en ESTE elemento.
                node.SetUserDefined(0, TabName, Sanitize(TabName), vec);
            }
        }

        private static string Sanitize(string s)
        {
            return new string((s ?? "").Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
        }

        // ---- DTOs --------------------------------------------------------
        private class DatasetInfo
        {
            public string key;
            public string name;
            public int count;
            public override string ToString()
            {
                return (string.IsNullOrEmpty(name) ? key : name) + "   (" + count + ")";
            }
        }

        private class Dataset
        {
            public string name;
            public string tagField;
            public List<string> headers;
            public List<Dictionary<string, string>> rows;
        }
    }
}
