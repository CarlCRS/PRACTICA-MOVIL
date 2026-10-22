package com.planseguro.plugin

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * LADO NATIVO ANDROID (Kotlin) — el "CÓMO" real de cada método del contrato.
 *
 * Puntos que debes poder explicar (matriz INGIF-1442):
 *  1. Cada @PluginMethod recibe un `call` con los argumentos serializados.
 *  2. try/catch + call.reject: si el nativo falla, TS recibe la Promise rechazada.
 *  3. Corrutinas: el SDK FacePhi nuevo expone suspend fun; aquí se demuestra
 *     el patrón "callbacks → suspend" con un SDK simulado.
 */
@CapacitorPlugin(name = "PlanSeguro")
class PlanSeguroPlugin : Plugin() {

    /** La corrutina vive en el scope del plugin: si Android destruye la Activity,
     *  SupervisorJob + cancel() cancela todo el subárbol sin filtros manuales. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ---------------------------------------------------- CALLBACKS → SUSPEND

    /** "SDK legacy": responde por callback, así era la API vieja de FacePhi. */
    interface SdkCallback {
        fun onResultado(salida: String)
        fun onError(e: Throwable)
    }

    private object SdkFalsoResumen {
        fun calcular(texto: String, max: Int, cb: SdkCallback) {
            try {
                // Trabajo "lento" que iría en Dispatchers.IO (red/disco/hw).
                val resumen: String = texto.trim().split(Regex("\\s+")).let { p ->
                    if (p.size <= max) texto.trim() else p.take(max).joinToString(" ") + "…"
                }
                cb.onResultado(resumen)
            } catch (t: Throwable) {
                cb.onError(t)
            }
        }
    }

    /** Envuelve el callback en una suspend fun (patrón de migración FacePhi). */
    private suspend fun resumenSuspend(texto: String, max: Int): String =
        suspendCancellableCoroutine { cont ->
            SdkFalsoResumen.calcula(texto, max, object : SdkCallback {
                override fun onResultado(salida: String) = cont.resume(salida)
                override fun onError(e: Throwable) = cont.resumeWithException(e)
            })
            // Si la corrutina se cancela, cancelamos también el SDK.
            cont.invokeOnCancellation { /* SdkReal.cancel() iría aquí */ }
        }

    // ---------------------------------------------------- MÉTODOS EXPUESTOS

    @PluginMethod
    fun guardar(call: PluginCall) {
        val plan = call.getObject("plan") ?: run {
            call.reject("FALTA_PLAN", "Se requiere { plan } serializable a JSON")
            return
        }
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val prefs = context.getSharedPreferences("planes_seguros", Context.MODE_PRIVATE)
                    val id = plan.getString("id") ?: "s-${System.currentTimeMillis()}"
                    val claves = prefs.getString("ids", "")?.split("|")?.filter { it.isNotBlank() }
                        ?: emptyList()
                    prefs.edit()
                        .putString(id, plan.toString())
                        .putString("ids", (listOf(id) + claves).joinToString("|"))
                        .apply()
                }
                call.resolve(JSObject().apply {
                    put("ok", true)
                    put("id", plan.getString("id") ?: "")
                })
            } catch (t: Throwable) {
                call.reject("ERROR_GUARDANDO", t.message, t)
            }
        }
    }

    @PluginMethod
    fun leer(call: PluginCall) {
        val max = call.getInt("max", 10)
        scope.launch {
            try {
                val planes = withContext(Dispatchers.IO) {
                    val prefs = context.getSharedPreferences("planes_seguros", Context.MODE_PRIVATE)
                    val ids = prefs.getString("ids", "")?.split("|")?.filter { it.isNotBlank() }
                        ?: emptyList()
                    ids.take(max).mapNotNull { it ->
                        prefs.getString(it, null)?.let { raw -> JSObject(raw) }
                    }
                }
                val arr = org.json.JSONArray()
                planes.forEach { arr.put(it) }
                call.resolve(JSObject().apply {
                    put("planes", arr)
                    // true cuando uses EncryptedSharedPreferences/Keychain real.
                    put("seguro", false)
                })
            } catch (t: Throwable) {
                call.reject("ERROR_LEYENDO", t.message, t)
            }
        }
    }

    @PluginMethod
    fun borrar(call: PluginCall) {
        val id = call.getString("id") ?: run {
            call.reject("FALTA_ID", "Se requiere el id a borrar")
            return
        }
        scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val prefs = context.getSharedPreferences("planes_seguros", Context.MODE_PRIVATE)
                    val ids = prefs.getString("ids", "")?.split("|")?.filter { it.isNotBlank() && it != id }
                        ?: emptyList()
                    prefs.edit().remove(id).putString("ids", ids.joinToString("|")).apply()
                }
                call.resolve()
            } catch (t: Throwable) {
                call.reject("ERROR_BORRANDO", t.message, t)
            }
        }
    }

    /** Muestra el patrón callbacks → suspend expuesto como método del plugin. */
    @PluginMethod
    fun resumen(call: PluginCall) {
        val texto = call.getString("texto") ?: ""
        val max = call.getInt("maxPalabras", 12)
        scope.launch {
            try {
                val salida = resumenSuspend(texto, max)
                call.resolve(JSObject().apply { put("resumen", salida) })
            } catch (t: Throwable) {
                call.reject("ERROR_SDK", t.message, t)
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel() // cleanup: libera el subárbol de corrutinas
        super.handleOnDestroy()
    }
}
