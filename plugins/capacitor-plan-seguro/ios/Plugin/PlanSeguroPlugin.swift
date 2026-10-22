package com.planseguro.plugin;

// PIEZA 5: LADO NATIVO iOS (Swift) — misma API que el plugin Android.
// Un plugin híbrido SIEMPRE tiene 2 lados nativos: lo que resuelve Android
// (Kotlin) y lo que resuelve iOS (Swift). La app TS no distingue entre ambos.

import Foundation

@objc(PlanSeguroPlugin)
public class PlanSeguroPlugin: CAPPlugin {

    // En iOS el equivalente a Keystore es el Keychain.
    // Para la demo se usa UserDefaults con key de servicio;
    // en producción: kSecClassGenericPassword + kSecAttrAccessibleWhenUnlockedThisDeviceOnly.
    private let service = "plan-seguro:planes"

    // ------------------------- guardar -------------------------
    @objc func guardar(_ call: CAPPluginCall) {
        guard let plan = call.getObject("plan") else {
            call.reject("FALTA_PLAN", "Se requiere { plan } serializable a JSON")
            return
        }
        guard let id = plan["id"] as? String, !id.isEmpty else {
            call.reject("FALTA_ID", "El plan necesita un id")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            // Lectura-escritura de "ids" + el plan (equivalente a lo que hace Kotlin).
            var planes = (UserDefaults.standard.object(forKey: self.service) as? [String: String]) ?? [:]
            planes[id] = (try? JSONSerialization.data(withJSONObject: plan, options: []))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

            UserDefaults.standard.set(planes, forKey: self.service)

            DispatchQueue.main.async {
                call.resolve([
                    "ok": true,
                    "id": id
                ])
            }
        }
    }

    // ------------------------- leer -------------------------
    @objc func leer(_ call: CAPPluginCall) {
        let max = call.getInt("max") ?? 10

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let almacen = (UserDefaults.standard.object(forKey: self.service) as? [String: String]) ?? [:]
            var salida: [[String: Any]] = []
            for (_, raw) in almacen.prefix(max) {
                if let data = raw.data(using: .utf8),
                   let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    salida.append(obj)
                }
            }

            DispatchQueue.main.async {
                call.resolve([
                    "planes": salida,
                    "seguro": false  // true cuando uses Keychain real
                ])
            }
        }
    }

    // ------------------------- borrar -------------------------
    @objc func borrar(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("FALTA_ID", "Se requiere el id a borrar")
            return
        }
        var planes = (UserDefaults.standard.object(forKey: self.service) as? [String: String]) ?? [:]
        planes.removeValue(forKey: id)
        UserDefaults.standard.set(planes, forKey: self.service)
        call.resolve()
    }

    // ------------------------- resumen (demo callbacks) -------------------------
    // En iOS el "SDK legacy" también responde por callback (completion handler);
    // aquí se simula el mismo patrón con DispatchQueue (Swift no usa corrutinas).
    @objc func resumen(_ call: CAPPluginCall) {
        let texto = call.getString("texto") ?? ""
        let max = call.getInt("maxPalabras") ?? 12

        DispatchQueue.global(qos: .userInitiated).asyncAfter(deadline: .now() + 0.05) {
            let palabras = texto.split(separator: " ").map { String($0) }
            let salida = palabras.count <= max ? texto : palabras.prefix(max).joined(separator: " ") + "…"
            DispatchQueue.main.async {
                call.resolve(["resumen": salida])
            }
        }
    }
}
