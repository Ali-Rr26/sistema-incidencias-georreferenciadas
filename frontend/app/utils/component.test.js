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

  it('preserves custom properties and methods', () => {
    const customMethod = () => {};
    const component = defineComponent({
      templateUrl: 'app/auth/pages/login/login.component.html',
      customMethod,
      myProp: 123,
    });

    expect(component.customMethod).toBe(customMethod);
    expect(component.myProp).toBe(123);
  });
});
