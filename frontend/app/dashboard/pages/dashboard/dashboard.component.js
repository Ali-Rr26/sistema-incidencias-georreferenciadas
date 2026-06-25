import { defineComponent } from '../../../utils/component.js';
import { http } from '../../../core/http.service.js';

export default defineComponent({
  templateUrl: 'app/dashboard/pages/dashboard/dashboard.component.html',
  styleUrl: 'app/dashboard/pages/dashboard/dashboard.component.css',

  async onInit() {
    try {
      const [incidenciasResp] = await Promise.all([
        http.get('/incidencias?per_page=1')
      ]);
      const total = incidenciasResp.total ?? 0;
      const pendientes = incidenciasResp.pendientes ?? 0;
      const resueltas = incidenciasResp.resueltas ?? 0;
      const ubicaciones = incidenciasResp.ubicaciones ?? 0;

      document.getElementById('stat-incidencias').textContent = total;
      document.getElementById('stat-pendientes').textContent = pendientes;
      document.getElementById('stat-resueltas').textContent = resueltas;
      document.getElementById('stat-ubicaciones').textContent = ubicaciones;
    } catch { /* keep zeros */ }

    if (window.feather) feather.replace();
  },

  onDestroy() {}
});
