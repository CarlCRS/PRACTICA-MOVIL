// PIEZA 6: REGISTRO OBJC — expone los métodos Swift al puente Capacitor iOS.
// CAP_PLUGIN_METHOD declara qué métodos puede llamar el lado TS.
// Si agregas un método al contrato y falta aquí, el TS recibirá "no such method".
#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(PlanSeguroPlugin, "PlanSeguro",
  CAP_PLUGIN_METHOD(guardar, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(leer, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(borrar, CAPPluginReturnPromise);
  CAP_PLUGIN_METHOD(resumen, CAPPluginReturnPromise);
)
