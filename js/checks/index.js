// Alle controlefabrieken bij elkaar, voor tests en tools (content-check). Een pagina gebruikt dit niet: die laadt per leerblok
// alleen wat ze nodig heeft (`laadControles` in register.js, PF-4, ADR B69).
import { registreer } from './register.js';
import * as LB1 from './lb1.js';
import * as LB2 from './lb2.js';
import * as LB3 from './lb3.js';
import * as LB4 from './lb4.js';

for (const m of [LB1, LB2, LB3, LB4]) registreer(m);

export * from './register.js';
