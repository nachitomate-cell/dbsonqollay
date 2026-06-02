// SonqollaySync — plugin de Navisworks 2026 que trae los datos editados en la
// web Sonqollay (GET /api/datasets/:key) y los escribe como propiedades custom
// en los elementos del modelo, vinculando por TAG.
//
// SIN dependencias externas (NuGet): usa WebClient + JavaScriptSerializer, ambos
// del .NET Framework 4.8. Compilar con SonqollaySync.csproj (net48 / x64).
// Ver README.md para instalación y configuración.

using System;
using System.Collections.Generic;
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
        // ----- CONFIGURACIÓN (editar) -------------------------------------
        private const string BaseUrl      = "https://basesonqollay.synaptechspa.cl";
        private const string ApiToken     = "PEGAR_EL_MISMO_SQY_API_TOKEN";
        private const string DatasetKey   = "PEGAR_LA_KEY_QUE_MOSTRO_LA_WEB";
        // Propiedad del modelo que contiene el TAG (en tus DWG suele ser la capa).
        private const string LinkProperty = "Layer";
        // Pestaña de propiedades custom que se agrega a los elementos.
        private const string TabName      = "Sonqollay";
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

            Dataset data;
            try
            {
                data = FetchDataset();
            }
            catch (Exception ex)
            {
                MessageBox.Show("No se pudo descargar el dataset:\n" + ex.Message);
                return 0;
            }

            string tagField = !string.IsNullOrEmpty(data.tagField)
                ? data.tagField
                : (data.headers.Count > 0 ? data.headers[0] : null);
            if (string.IsNullOrEmpty(tagField))
            {
                MessageBox.Show("El dataset no define la columna de TAG (tagField).");
                return 0;
            }

            int matched = 0, applied = 0, missing = 0;

            foreach (var row in data.rows)
            {
                string tag;
                if (!row.TryGetValue(tagField, out tag) || string.IsNullOrWhiteSpace(tag))
                    continue;

                ModelItemCollection items = FindByTag(doc, tag);
                if (items.Count == 0) { missing++; continue; }
                matched++;

                // Selecciona los items de este TAG y les escribe la pestaña custom.
                doc.CurrentSelection.CopyFrom(items);
                WriteCustomTab(row, tagField);
                applied += items.Count;
            }

            MessageBox.Show(
                "Sonqollay Sync\n\n" +
                "Dataset: " + data.name + "\n" +
                "Filas: " + data.rows.Count + "\n" +
                "TAGs encontrados: " + matched + "\n" +
                "Elementos actualizados: " + applied + "\n" +
                "TAGs sin geometría: " + missing + "\n\n" +
                "Guardá el archivo (.nwf/.nwd) para conservar las propiedades.");
            return 0;
        }

        // ---- 1) Descargar el dataset por HTTP ----------------------------
        private Dataset FetchDataset()
        {
            string url = BaseUrl.TrimEnd('/') + "/api/datasets/" + Uri.EscapeDataString(DatasetKey);
            string json;
            using (var wc = new WebClient())
            {
                wc.Encoding = System.Text.Encoding.UTF8;
                if (!string.IsNullOrEmpty(ApiToken))
                    wc.Headers[HttpRequestHeader.Authorization] = "Bearer " + ApiToken;
                try
                {
                    json = wc.DownloadString(url);
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
            return ParseDataset(json);
        }

        private Dataset ParseDataset(string json)
        {
            var ser = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };
            var root = ser.DeserializeObject(json) as Dictionary<string, object>;
            var ds = new Dataset
            {
                name = root != null && root.ContainsKey("name") ? Convert.ToString(root["name"]) : DatasetKey,
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

        // ---- 2) Matchear por TAG -----------------------------------------
        // Busca items cuya propiedad de vínculo == tag. Si no encuentra por esa
        // propiedad, hace un fallback por el nombre del item.
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

        // ---- 3) Escribir propiedades custom (COM API) --------------------
        private void WriteCustomTab(Dictionary<string, string> row, string tagField)
        {
            ComApi.InwOpState10 state = ComApiBridge.State;

            // Vector de propiedades con los campos editados (omite el propio TAG).
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

            // Aplica la pestaña a la selección actual (los items de este TAG).
            state.SetUserDefined(0, TabName, Sanitize(TabName), vec);
        }

        private static string Sanitize(string s)
        {
            return new string((s ?? "").Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
        }

        // DTO del JSON del endpoint.
        private class Dataset
        {
            public string name;
            public string tagField;
            public List<string> headers;
            public List<Dictionary<string, string>> rows;
        }
    }
}
