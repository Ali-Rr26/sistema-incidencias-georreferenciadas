/**
 * Component helper — equivalente al decorador @Component de Angular.
 *
 * Uso:
 *   export default defineComponent({
 *     templateUrl: 'app/auth/pages/login/login.component.html',
 *     styleUrl:    'app/auth/pages/login/login.component.css',
 *     onInit()     { /* bind eventos, init Bootstrap JS *\/ },
 *     onDestroy()  { /* cleanup *\/ },
 *   });
 */
export function defineComponent(config) {
  return config;
}
