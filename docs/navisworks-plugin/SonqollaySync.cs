// SonqollaySync — plugin de Navisworks que trae los datos editados en la web
// Sonqollay (GET /api/datasets/:key) y los escribe como propiedades custom en
// los elementos del modelo, vinculando por TAG.
//
// Compilar como Class Library (.NET Framework de tu Navisworks). Referencias:
//   Autodesk.Navisworks.Api.dll
//   Autodesk.Navisworks.ComApi.dll
//   Autodesk.Navisworks.Interop.ComApi.dll
//
// Ver README.md para instalación y configuración.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
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
        private const string BaseUrl     = "https://basesonqollay.synaptechspa.cl";
        private const string ApiToken    = "PEGAR_EL_MISMO_SQY_API_TOKEN";
        private const string DatasetKey  = "PEGAR_LA_KEY_QUE_MOSTRO_LA_WEB";
        // Propiedad del modelo que contiene el TAG (en tus DWG suele ser la capa).
        private const string LinkProperty = "Layer";
        // Pestaña de propiedades custom que se agrega a los elementos.
        private const string TabName = "Sonqollay";
        // ------------------------------------------------------------------

        private static readonly HttpClient Http = new HttpClient();

        public override int Execute(params string[] parameters)
        {
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

            string tagField = data.tagField ?? (data.headers != null && data.headers.Count > 0 ? data.headers[0] : null);
            if (string.IsNullOrEmpty(tagField))
            {
                MessageBox.Show("El dataset no define la columna de TAG (tagField).");
                return 0;
            }

            int matched = 0, applied = 0, missing = 0;

            foreach (var row in data.rows)
            {
                if (!row.TryGetValue(tagField, out string tag) || string.IsNullOrWhiteSpace(tag))
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
                $"Sonqollay Sync\n\nDataset: {data.name}\nFilas: {data.rows.Count}\n" +
                $"TAGs encontrados: {matched}\nElementos actualizados: {applied}\n" +
                $"TAGs sin geometría: {missing}\n\n" +
                "Guardá el archivo (.nwf/.nwd) para conservar las propiedades.");
            return 0;
        }

        // ---- 1) Descargar el dataset por HTTP ----------------------------
        private Dataset FetchDataset()
        {
            string url = $"{BaseUrl}/api/datasets/{Uri.EscapeDataString(DatasetKey)}";
            var req = new HttpRequestMessage(HttpMethod.Get, url);
            if (!string.IsNullOrEmpty(ApiToken))
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ApiToken);

            HttpResponseMessage res = Http.SendAsync(req).GetAwaiter().GetResult();
            string json = res.Content.ReadAsStringAsync().GetAwaiter().GetResult();
            if (!res.IsSuccessStatusCode)
                throw new Exception($"HTTP {(int)res.StatusCode}: {json}");

            return ParseDataset(json);
        }

        private Dataset ParseDataset(string json)
        {
            using var d = JsonDocument.Parse(json);
            var root = d.RootElement;
            var ds = new Dataset
            {
                name = root.TryGetProperty("name", out var n) ? n.GetString() : DatasetKey,
                tagField = root.TryGetProperty("tagField", out var tf) ? tf.GetString() : null,
                headers = new List<string>(),
                rows = new List<Dictionary<string, string>>(),
            };
            if (root.TryGetProperty("headers", out var hs))
                foreach (var h in hs.EnumerateArray()) ds.headers.Add(h.GetString());

            if (root.TryGetProperty("rows", out var rows))
            {
                foreach (var r in rows.EnumerateArray())
                {
                    var dict = new Dictionary<string, string>();
                    foreach (var prop in r.EnumerateObject())
                        dict[prop.Name] = prop.Value.ValueKind == JsonValueKind.String
                            ? prop.Value.GetString()
                            : prop.Value.ToString();
                    ds.rows.Add(dict);
                }
            }
            return ds;
        }

        // ---- 2) Matchear por TAG -----------------------------------------
        // Busca items cuya propiedad de vínculo == tag. Si no encuentra por esa
        // propiedad, hace un escaneo amplio (cualquier propiedad), como la web.
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

            // Fallback: escaneo amplio por nombre del item.
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
            // TODO verificar la firma exacta según la versión del SDK:
            //   SetUserDefined(int index, string name, string internalName, InwOaPropertyVec vec)
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
