// Aura BIM — plugin de Navisworks 2026 que trae los datos editados en la
// web Aura BIM y los escribe como propiedades custom en los elementos del
// modelo, vinculando por TAG.
//
// Al ejecutarlo, lista las planillas publicadas (GET /api/datasets) y te deja
// ELEGIR cuáles sincronizar (una, varias o todas). NO hay que recompilar para
// cambiar de planilla.
//
// SIN dependencias externas (NuGet): WebClient + JavaScriptSerializer, ambos del
// .NET Framework 4.8. Compilar con AuraBIM.csproj (net48 / x64).
// Ver README.md para instalación y configuración.

using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Web.Script.Serialization; // System.Web.Extensions (framework)
using System.Windows.Forms;

using Autodesk.Navisworks.Api;
using Autodesk.Navisworks.Api.Plugins;

// COM API (para ESCRIBIR propiedades; el API .NET es de solo lectura)
using ComApi = Autodesk.Navisworks.Api.Interop.ComApi;
using ComApiBridge = Autodesk.Navisworks.Api.ComApi.ComApiBridge;

namespace AuraBIM
{
    // Ribbon propio: pestaña "Aura BIM" con botón "Asignar Propiedades" (definidos
    // en AuraBIM.xaml / .name del bundle).
    [Plugin("AuraBIM", "ABM",
            DisplayName = "Aura BIM",
            ToolTip = "Trae los datos editados en Aura BIM y los escribe en el modelo")]
    [Strings("AuraBIM.name")]
    [RibbonLayout("AuraBIM.xaml")]
    [RibbonTab("ID_TabAuraBIM", LoadForCanExecute = true)]
    [Command("ID_AsignarProps", LoadForCanExecute = true)]
    public class AuraBIM : CommandHandlerPlugin
    {
        // Versión del plugin (para el log de sincronización y soporte). Mantener
        // en sync con AppVersion de bundle/PackageContents.xml.
        private const string Version = "1.9.0";

        // El ribbon invoca este método con el id del botón.
        public override int ExecuteCommand(string commandId, params string[] parameters)
        {
            return commandId == "ID_AsignarProps" ? RunSync() : 0;
        }

        // El botón siempre está habilitado (la validación de "hay modelo abierto"
        // ya está dentro de RunSync).
        public override CommandState CanExecuteCommand(string commandId)
        {
            return new CommandState(true);
        }

        // La configuración (URL, token, propiedad de vínculo) se lee de
        // AuraBIM.config.json, ubicado junto al DLL. Ver clase Cfg al final
        // y el archivo de ejemplo en instalador/. Así NO hay que recompilar para
        // cambiar el token o la URL: se distribuye el mismo DLL para todos.

        private int RunSync()
        {
            // Vercel exige TLS 1.2+. En net48 suele estar por defecto, pero lo
            // forzamos para evitar errores de handshake en máquinas viejas.
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            Document doc = Autodesk.Navisworks.Api.Application.ActiveDocument;
            if (doc == null || doc.Models.Count == 0)
            {
                MessageBox.Show("Abre primero un modelo en Navisworks.");
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
                                "En la web Aura BIM, abre cada planilla y pulsa \"Publicar para Navisworks\".");
                return 0;
            }

            // 2) Elegir cuáles sincronizar.
            List<DatasetInfo> chosen = ShowPicker(index);
            if (chosen.Count == 0) return 0; // canceló o no marcó ninguna

            // 3-4) Índice + aplicar, con ventana de progreso propia (logos + barra +
            // cancelar): mantiene la UI viva (sin "no responde") en modelos grandes.
            int totalRows = 0, totalMatched = 0, totalApplied = 0, totalMissing = 0;
            var errores = new List<string>();
            var progress = new ProgressForm();
            progress.Show();
            progress.Refresh();
            try
            {
                Dictionary<string, ModelItemCollection> tagIndex = BuildTagIndex(doc, progress);

                if (!progress.Canceled)
                {
                    foreach (var info in chosen)
                    {
                        try
                        {
                            progress.Report(0.80, "Sincronizando: " + info.name);
                            Dataset data = FetchDataset(info.key);
                            var res = ApplyDataset(tagIndex, data, progress);
                            totalRows += data.rows.Count;
                            totalMatched += res.matched;
                            totalApplied += res.applied;
                            totalMissing += res.missing;
                        }
                        catch (Exception ex)
                        {
                            errores.Add(info.name + ": " + ex.Message);
                        }
                        if (progress.Canceled) break;
                    }
                }
            }
            finally
            {
                progress.Close();
                progress.Dispose();
            }

            // Log para soporte (en %LOCALAPPDATA%\AuraBIM\AuraBIM.log).
            WriteLog(string.Format(
                "sync v{0} | planillas={1} filas={2} matched={3} aplicados={4} sinGeom={5} cancelado={6}{7}",
                Version, chosen.Count, totalRows, totalMatched, totalApplied, totalMissing, progress.Canceled,
                errores.Count > 0 ? " | errores: " + string.Join(" ; ", errores) : ""));

            string msg =
                "Aura BIM v" + Version + "\n\n" +
                "Planillas: " + chosen.Count + "\n" +
                "Filas: " + totalRows + "\n" +
                "TAGs encontrados: " + totalMatched + "\n" +
                "Elementos actualizados: " + totalApplied + "\n" +
                "TAGs sin geometría: " + totalMissing + "\n\n" +
                "Guarda el archivo (.nwf/.nwd) para conservar las propiedades.";
            if (errores.Count > 0)
                msg += "\n\nErrores:\n - " + string.Join("\n - ", errores);
            MessageBox.Show(msg);
            return 0;
        }

        // Log best-effort de cada sincronización (para diagnóstico remoto). Se
        // escribe en %LOCALAPPDATA%\AuraBIM (siempre escribible por el usuario, a
        // diferencia de la carpeta del bundle en ApplicationPlugins).
        private static void WriteLog(string text)
        {
            try
            {
                string dir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AuraBIM");
                Directory.CreateDirectory(dir);
                File.AppendAllText(Path.Combine(dir, "AuraBIM.log"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + text + Environment.NewLine);
            }
            catch { /* el log nunca debe romper la sincronización */ }
        }

        // ---- Aplicar un dataset al modelo --------------------------------
        private struct ApplyResult { public int matched, applied, missing; }

        private ApplyResult ApplyDataset(Dictionary<string, ModelItemCollection> tagIndex, Dataset data,
                                         ProgressForm progress)
        {
            string tagField = !string.IsNullOrEmpty(data.tagField)
                ? data.tagField
                : (data.headers.Count > 0 ? data.headers[0] : null);
            var res = new ApplyResult();
            if (string.IsNullOrEmpty(tagField)) return res;

            int i = 0, total = data.rows.Count;
            foreach (var row in data.rows)
            {
                if ((++i % 25) == 0)
                {
                    progress.Report(0.80 + 0.20 * (i / (double)Math.Max(1, total)),
                                    "Escribiendo propiedades… (" + i + "/" + total + ")");
                    if (progress.Canceled) return res;
                }

                string tag;
                if (!row.TryGetValue(tagField, out tag) || string.IsNullOrWhiteSpace(tag))
                    continue;
                tag = tag.Trim();

                ModelItemCollection items;
                if (!tagIndex.TryGetValue(tag, out items) || items.Count == 0) { res.missing++; continue; }
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
                if (!string.IsNullOrEmpty(Cfg.ApiToken))
                    wc.Headers[HttpRequestHeader.Authorization] = "Bearer " + Cfg.ApiToken;
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
            string json = HttpGet(Cfg.BaseUrl.TrimEnd('/') + "/api/datasets");
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
            string json = HttpGet(Cfg.BaseUrl.TrimEnd('/') + "/api/datasets/" + Uri.EscapeDataString(key));
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

        // Código de disciplina de una planilla: va entre paréntesis al final del
        // nombre, p. ej. "Alumbrado (ALU)" o "Equipos EEL-01 (ELE)" -> ALU / ELE.
        // Si no hay código, devuelve "—" (sin disciplina).
        private static string DisciplineOf(DatasetInfo d)
        {
            string s = d != null ? (d.name ?? "") : "";
            int close = s.LastIndexOf(')');
            if (close > 0)
            {
                int open = s.LastIndexOf('(', close - 1);
                if (open >= 0 && close - open > 1)
                {
                    string code = s.Substring(open + 1, close - open - 1).Trim();
                    if (code.Length > 0) return code.ToUpperInvariant();
                }
            }
            return "—";
        }

        // ---- UI: elegir planillas ----------------------------------------
        private static List<DatasetInfo> ShowPicker(List<DatasetInfo> all)
        {
            var form = new Form
            {
                Text = "Aura BIM — elige las planillas a sincronizar",
                ClientSize = new Size(460, 410),
                StartPosition = FormStartPosition.CenterScreen,
                FormBorderStyle = FormBorderStyle.FixedDialog,
                MinimizeBox = false,
                MaximizeBox = false,
            };

            // Filtro por disciplina (combo) + "Seleccionar todos" (maestro).
            var lblDisc = new Label { Text = "Disciplina:", Left = 12, Top = 16, Width = 64, Height = 20 };
            var cboDisc = new ComboBox
            {
                Left = 78, Top = 12, Width = 180, Height = 24,
                DropDownStyle = ComboBoxStyle.DropDownList,
            };
            cboDisc.Items.Add("Todas");
            foreach (var disc in all.Select(DisciplineOf).Distinct().OrderBy(x => x, StringComparer.Ordinal))
                cboDisc.Items.Add(disc);
            cboDisc.SelectedIndex = 0;

            var chkAll = new CheckBox
            {
                Text = "Seleccionar todos", Left = 288, Top = 14, Width = 160, Height = 20,
                Checked = true,
            };

            var clb = new CheckedListBox
            {
                Left = 12, Top = 44, Width = 436, Height = 300,
                CheckOnClick = true,
                IntegralHeight = false,
            };

            // El marcado se guarda por planilla y se conserva al cambiar de filtro:
            // la disciplina es solo una vista; "Sincronizar" envía TODAS las marcadas.
            var checkState = new Dictionary<DatasetInfo, bool>();
            foreach (var d in all) checkState[d] = true;

            bool refreshing = false;

            // El maestro queda marcado solo si TODO lo visible está marcado.
            void SyncMaster()
            {
                bool allChecked = clb.Items.Count > 0;
                foreach (var it in clb.Items)
                {
                    var d = it as DatasetInfo;
                    if (d != null && !checkState[d]) { allChecked = false; break; }
                }
                chkAll.Checked = allChecked;
            }

            // Repinta la lista según la disciplina elegida, conservando el marcado.
            void Repopulate()
            {
                refreshing = true;
                clb.Items.Clear();
                string disc = cboDisc.SelectedItem as string ?? "Todas";
                foreach (var d in all)
                {
                    if (disc != "Todas" && DisciplineOf(d) != disc) continue;
                    clb.Items.Add(d, checkState[d]);
                }
                refreshing = false;
                SyncMaster();
            }

            clb.ItemCheck += (s, e) =>
            {
                if (refreshing) return;
                var d = clb.Items[e.Index] as DatasetInfo;
                if (d != null) checkState[d] = (e.NewValue == CheckState.Checked);
                SyncMaster();
            };
            cboDisc.SelectedIndexChanged += (s, e) => Repopulate();
            chkAll.Click += (s, e) =>
            {
                // Marca/desmarca todo lo visible (y guarda su estado).
                refreshing = true;
                bool target = chkAll.Checked;
                for (int i = 0; i < clb.Items.Count; i++)
                {
                    clb.SetItemChecked(i, target);
                    var d = clb.Items[i] as DatasetInfo;
                    if (d != null) checkState[d] = target;
                }
                refreshing = false;
            };

            var ok = new Button { Text = "Sincronizar", Left = 268, Top = 356, Width = 90, Height = 30, DialogResult = DialogResult.OK };
            var cancel = new Button { Text = "Cancelar", Left = 364, Top = 356, Width = 84, Height = 30, DialogResult = DialogResult.Cancel };
            form.Controls.Add(lblDisc);
            form.Controls.Add(cboDisc);
            form.Controls.Add(chkAll);
            form.Controls.Add(clb);
            form.Controls.Add(ok);
            form.Controls.Add(cancel);
            form.AcceptButton = ok;
            form.CancelButton = cancel;

            Repopulate();

            if (form.ShowDialog() != DialogResult.OK) return new List<DatasetInfo>();
            // Todas las marcadas (en cualquier disciplina), no solo las visibles.
            return all.Where(d => checkState[d]).ToList();
        }

        // ---- Matchear por TAG --------------------------------------------
        // Recorre todos los elementos una vez y arma un índice TAG -> elementos,
        // leyendo la propiedad de vínculo directamente (sin distinción de
        // mayúsculas ni dependencia del idioma del Search API).
        private Dictionary<string, ModelItemCollection> BuildTagIndex(Document doc, ProgressForm progress)
        {
            var map = new Dictionary<string, ModelItemCollection>(StringComparer.OrdinalIgnoreCase);
            int n = 0;
            foreach (Model m in doc.Models)
            {
                foreach (ModelItem item in m.RootItem.DescendantsAndSelf)
                {
                    // Refresca la ventana cada 1000 elementos: bombea la UI (evita
                    // "no responde") y permite cancelar. Fracción asintótica 0..0.8
                    // porque no sabemos el total de antemano.
                    if ((++n % 1000) == 0)
                    {
                        progress.Report(0.80 * (n / (double)(n + 20000)),
                                        "Indexando modelo: " + n.ToString("N0") + " elementos…");
                        if (progress.Canceled) return map;
                    }

                    string tag = GetTagValue(item);
                    if (string.IsNullOrWhiteSpace(tag)) continue;
                    tag = tag.Trim();
                    ModelItemCollection coll;
                    if (!map.TryGetValue(tag, out coll)) { coll = new ModelItemCollection(); map[tag] = coll; }
                    coll.Add(item);
                }
            }
            return map;
        }

        // Devuelve el valor de la propiedad de vínculo del elemento (TAG/Commodity).
        // Si Cfg.LinkCategory está vacío, busca la propiedad en cualquier pestaña.
        private string GetTagValue(ModelItem item)
        {
            // Camino rápido: si la categoría está configurada (caso normal, BIM),
            // buscamos dentro de esa pestaña SIN distinguir mayús/minús, tanto en el
            // nombre de la pestaña como en el de la propiedad. Esto es clave para que
            // sea repetible: la web escribe "TAG/COMMODITY" y Aura BIM dejó
            // "TAG/Commodity"; ambos deben matchear contra Cfg.LinkProperty.
            if (!string.IsNullOrEmpty(Cfg.LinkCategory))
            {
                foreach (PropertyCategory cat in item.PropertyCategories)
                {
                    if (!string.Equals(cat.DisplayName, Cfg.LinkCategory, StringComparison.OrdinalIgnoreCase))
                        continue;
                    foreach (DataProperty p in cat.Properties)
                    {
                        if (!string.Equals(p.DisplayName, Cfg.LinkProperty, StringComparison.OrdinalIgnoreCase))
                            continue;
                        string val = p.Value != null ? p.Value.ToDisplayString() : null;
                        return string.IsNullOrWhiteSpace(val) ? null : val;
                    }
                }
                return null;
            }

            // Camino lento (solo si no se configuró categoría): buscar en cualquier pestaña.
            string fallback = null;
            foreach (PropertyCategory cat in item.PropertyCategories)
            {
                foreach (DataProperty p in cat.Properties)
                {
                    if (!string.Equals(p.DisplayName, Cfg.LinkProperty, StringComparison.OrdinalIgnoreCase))
                        continue;
                    string v = p.Value != null ? p.Value.ToDisplayString() : null;
                    if (string.IsNullOrWhiteSpace(v)) continue;
                    // Preferimos la pestaña configurada; si no, servimos cualquiera.
                    if (string.IsNullOrEmpty(Cfg.LinkCategory) ||
                        string.Equals(cat.DisplayName, Cfg.LinkCategory, StringComparison.OrdinalIgnoreCase))
                        return v;
                    if (fallback == null) fallback = v;
                }
            }
            return fallback;
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

                // Quitar pestañas "Aura BIM" previas para no acumular duplicados al
                // re-sincronizar. SetUserDefined(0,...) crea SIEMPRE una nueva; el índice
                // de RemoveUserDefined es 1-based entre las pestañas "user-defined".
                var toRemove = new List<int>();
                int udx = 0;
                foreach (ComApi.InwGUIAttribute2 att in node.GUIAttributes())
                {
                    if (!att.UserDefined) continue;
                    udx++;
                    if (string.Equals(att.ClassUserName, Cfg.TabName, StringComparison.OrdinalIgnoreCase))
                        toRemove.Add(udx);
                }
                for (int i = toRemove.Count - 1; i >= 0; i--)
                    node.RemoveUserDefined(toRemove[i]);

                ComApi.InwOaPropertyVec vec = (ComApi.InwOaPropertyVec)state.ObjectFactory(
                    ComApi.nwEObjectType.eObjectType_nwOaPropertyVec, null, null);

                foreach (var kv in row)
                {
                    // Escribimos TODAS las columnas, incluida la del TAG: así la pestaña
                    // BIM conserva TAG/Commodity y el sync sigue siendo repetible (la
                    // próxima corrida vuelve a matchear por esa propiedad).
                    ComApi.InwOaProperty p = (ComApi.InwOaProperty)state.ObjectFactory(
                        ComApi.nwEObjectType.eObjectType_nwOaProperty, null, null);
                    p.name = Sanitize(kv.Key);   // nombre interno
                    p.UserName = kv.Key;          // nombre visible
                    p.value = kv.Value ?? "";
                    vec.Properties().Add(p);
                }

                // Crea la pestaña custom fresca en ESTE elemento (0 = nueva).
                node.SetUserDefined(0, Cfg.TabName, Sanitize(Cfg.TabName), vec);
            }
        }

        private static string Sanitize(string s)
        {
            return new string((s ?? "").Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());
        }

        // ---- Ventana de progreso (logo + barra + cancelar) --------------
        // Logo Aura BIM arriba. Reemplaza a la barra nativa para mostrar el logo.
        private sealed class ProgressForm : Form
        {
            private readonly ProgressBar _bar;
            private readonly Label _status;
            public bool Canceled { get; private set; }

            public ProgressForm()
            {
                Text = "Aura BIM";
                FormBorderStyle = FormBorderStyle.FixedDialog;
                StartPosition = FormStartPosition.CenterScreen;
                MaximizeBox = false; MinimizeBox = false; ShowInTaskbar = false;
                TopMost = true;
                BackColor = System.Drawing.Color.White;
                ClientSize = new Size(380, 234);

                var sqy = LoadLogo("aurabim.png");   // ~108x104

                // Logo Aura BIM, protagonista y centrado arriba.
                var pbSqy = new PictureBox
                {
                    Image = sqy,
                    SizeMode = PictureBoxSizeMode.AutoSize,
                    Top = 18,
                };
                pbSqy.Left = (ClientSize.Width - (sqy?.Width ?? 86)) / 2;

                _status = new Label
                {
                    Text = "Preparando…",
                    AutoSize = false,
                    TextAlign = ContentAlignment.MiddleCenter,
                    Left = 20, Top = 140, Width = ClientSize.Width - 40, Height = 20,
                    ForeColor = System.Drawing.Color.FromArgb(80, 90, 100),
                };

                _bar = new ProgressBar
                {
                    Left = 24, Top = 166, Width = ClientSize.Width - 48, Height = 18,
                    Minimum = 0, Maximum = 100, Style = ProgressBarStyle.Continuous,
                };

                var btnCancel = new Button
                {
                    Text = "Cancelar", Width = 90, Height = 28,
                    Top = 196, Left = (ClientSize.Width - 90) / 2,
                };
                btnCancel.Click += (s, e) => { Canceled = true; btnCancel.Enabled = false; _status.Text = "Cancelando…"; };

                Controls.Add(pbSqy);
                Controls.Add(_status);
                Controls.Add(_bar);
                Controls.Add(btnCancel);

                ControlBox = false; // sin botón cerrar: se usa Cancelar
            }

            // Actualiza barra + texto y bombea la UI (evita "no responde").
            public void Report(double fraction, string text)
            {
                int v = (int)(Math.Max(0, Math.Min(1, fraction)) * 100);
                if (_bar.Value != v) _bar.Value = v;
                if (text != null) _status.Text = text;
                System.Windows.Forms.Application.DoEvents();
            }

            private static Image LoadLogo(string resourceName)
            {
                try
                {
                    var asm = Assembly.GetExecutingAssembly();
                    using (var s = asm.GetManifestResourceStream(resourceName))
                    {
                        if (s == null) return null;
                        using (var tmp = Image.FromStream(s))
                            return new Bitmap(tmp); // copia: la imagen sobrevive al stream
                    }
                }
                catch { return null; }
            }
        }

        // ---- Configuración (AuraBIM.config.json junto al DLL) ------
        // Valores por defecto embebidos; el config.json los pisa si existe.
        // Así se distribuye el mismo DLL para todos y solo cambia el .json.
        private static class Cfg
        {
            public static string BaseUrl = "https://basesonqollay.synaptechspa.cl";
            public static string ApiToken = "";
            public static string LinkCategory = "BIM";
            public static string LinkProperty = "TAG/Commodity";
            // Pestaña de propiedades que se escribe. Por diseño coincide con
            // LinkCategory: se lee y se reescribe la MISMA pestaña "BIM" (conserva
            // TAG/Commodity → el sync es repetible). El config la puede pisar.
            public static string TabName = "BIM";

            static Cfg() { Load(); }

            private static void Load()
            {
                try
                {
                    string dir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
                    string path = Path.Combine(dir, "AuraBIM.config.json");
                    if (!File.Exists(path)) return;
                    var d = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(path))
                            as Dictionary<string, object>;
                    if (d == null) return;
                    if (d.ContainsKey("baseUrl")) BaseUrl = Convert.ToString(d["baseUrl"]);
                    if (d.ContainsKey("apiToken")) ApiToken = Convert.ToString(d["apiToken"]);
                    if (d.ContainsKey("linkCategory")) LinkCategory = Convert.ToString(d["linkCategory"]);
                    if (d.ContainsKey("linkProperty")) LinkProperty = Convert.ToString(d["linkProperty"]);
                    if (d.ContainsKey("tabName")) TabName = Convert.ToString(d["tabName"]);
                }
                catch { /* ante cualquier error, se usan los valores por defecto */ }
            }
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
