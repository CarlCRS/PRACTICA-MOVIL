import { WebPlugin } from '@capacitor/core';

// Fallback local (copia de capacitor-echo-plugin/src/web.ts)
// para demo sin instalar el paquete. En real viene del plugin.
export class EchoWebFallback extends WebPlugin {
  async echo(options: { msg: string }): Promise<{ msg: string }> {
    console.log('EchoWeb:', options.msg);
    return options;
  }
}
