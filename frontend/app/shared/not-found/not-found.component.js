import { defineComponent } from '../../utils/component.js';

export default defineComponent({
  templateUrl: 'app/shared/not-found/not-found.component.html',

  onInit() {
    if (window.feather) feather.replace();
  },

  onDestroy() {}
});
