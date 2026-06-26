import { defineComponent } from './component.js';

describe('defineComponent', () => {
  it('keeps the component contract intact', () => {
    const onInit = vi.fn();
    const onDestroy = vi.fn();

    const component = defineComponent({
      templateUrl: 'app/auth/pages/login/login.component.html',
      styleUrl: 'app/auth/pages/login/login.component.css',
      onInit,
      onDestroy,
    });

    expect(component).toEqual({
      templateUrl: 'app/auth/pages/login/login.component.html',
      styleUrl: 'app/auth/pages/login/login.component.css',
      onInit,
      onDestroy,
    });
  });
});
