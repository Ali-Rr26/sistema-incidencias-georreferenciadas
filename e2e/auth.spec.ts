import { test, expect } from '@playwright/test';
import { User, Menu, Role, Permission } from '../backend/database/factories';

test.describe('Autenticación', () => {
  test.beforeEach(async ({ page }) => {
    // Limpiar base de datos antes de cada test
    // En un proyecto real, usarías una DB limpia por test
  });

  test('usuario puede ver la página de login', async ({ page }) => {
    await page.goto('/login.html');

    await expect(page.locator('h4')).toContainText('Iniciar Sesión');
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('usuario puede iniciar sesión con credenciales válidas', async ({ page }) => {
    await page.goto('/login.html');

    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');

    // Verificar que redirige al dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Verificar que muestra el nombre del usuario
    await expect(page.locator('#userInfo')).toBeVisible();
  });

  test('login falla con credenciales inválidas', async ({ page }) => {
    await page.goto('/login.html');

    await page.fill('#email', 'wrong@test.com');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Esperar mensaje de error
    await expect(page.locator('.alert, .text-danger, [role="alert"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('usuario puede cerrar sesión', async ({ page }) => {
    // Primero iniciar sesión
    await page.goto('/login.html');
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');

    // Esperar a que cargue el dashboard
    await page.waitForURL(/.*dashboard/);

    // Hacer logout
    await page.click('text=Cerrar Sesión');

    // Verificar que redirige al login
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe('Dashboard y Menús', () => {
  test.beforeEach(async ({ page }) => {
    // Login antes de cada test
    await page.goto('/login.html');
    await page.fill('#email', 'test@test.com');
    await page.fill('#password', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL(/.*dashboard/);
  });

  test('dashboard carga los menús del usuario', async ({ page }) => {
    // Esperar a que carguen los menús
    await page.waitForSelector('#menuList li', { timeout: 5000 });

    // Verificar que hay al menos un elemento en el menú
    const menuItems = await page.locator('#menuList li').count();
    expect(menuItems).toBeGreaterThan(0);
  });

  test('menús tienen los atributos correctos', async ({ page }) => {
    await page.waitForSelector('#menuList li a', { timeout: 5000 });

    const menuLink = page.locator('#menuList li a').first();
    await expect(menuLink).toHaveAttribute('href', /.+/);
  });

  test('logout aparece en el menú', async ({ page }) => {
    await page.waitForSelector('text=Cerrar Sesión', { timeout: 5000 });
    await expect(page.locator('text=Cerrar Sesión')).toBeVisible();
  });
});

test.describe('Navegación protegida', () => {
  test('usuario no autenticado es redirigido al login', async ({ page }) => {
    await page.goto('/dashboard.html');

    // Verificar que redirige al login
    await expect(page).toHaveURL(/.*login/);
  });

  test('token inválido redirige al login', async ({ page, context }) => {
    // Guardar un token inválido
    await context.addInitScript(() => {
      localStorage.setItem('token', 'token-invalido');
      localStorage.setItem('user', JSON.stringify({ name: 'Test' }));
    });

    await page.goto('/dashboard.html');

    // Esperar a que se valide y redirija
    await page.waitForURL(/.*login/, { timeout: 10000 });
  });
});
