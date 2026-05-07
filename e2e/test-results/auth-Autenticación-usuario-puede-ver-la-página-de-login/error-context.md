# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> Autenticación >> usuario puede ver la página de login
- Location: auth.spec.ts:10:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/login.html", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { User, Menu, Role, Permission } from '../backend/database/factories';
  3   | 
  4   | test.describe('Autenticación', () => {
  5   |   test.beforeEach(async ({ page }) => {
  6   |     // Limpiar base de datos antes de cada test
  7   |     // En un proyecto real, usarías una DB limpia por test
  8   |   });
  9   | 
  10  |   test('usuario puede ver la página de login', async ({ page }) => {
> 11  |     await page.goto('/login.html');
      |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  12  | 
  13  |     await expect(page.locator('h4')).toContainText('Iniciar Sesión');
  14  |     await expect(page.locator('input[id="email"]')).toBeVisible();
  15  |     await expect(page.locator('input[id="password"]')).toBeVisible();
  16  |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  17  |   });
  18  | 
  19  |   test('usuario puede iniciar sesión con credenciales válidas', async ({ page }) => {
  20  |     await page.goto('/login.html');
  21  | 
  22  |     await page.fill('#email', 'test@test.com');
  23  |     await page.fill('#password', 'password');
  24  |     await page.click('button[type="submit"]');
  25  | 
  26  |     // Verificar que redirige al dashboard
  27  |     await expect(page).toHaveURL(/.*dashboard/);
  28  | 
  29  |     // Verificar que muestra el nombre del usuario
  30  |     await expect(page.locator('#userInfo')).toBeVisible();
  31  |   });
  32  | 
  33  |   test('login falla con credenciales inválidas', async ({ page }) => {
  34  |     await page.goto('/login.html');
  35  | 
  36  |     await page.fill('#email', 'wrong@test.com');
  37  |     await page.fill('#password', 'wrongpassword');
  38  |     await page.click('button[type="submit"]');
  39  | 
  40  |     // Esperar mensaje de error
  41  |     await expect(page.locator('.alert, .text-danger, [role="alert"]')).toBeVisible({
  42  |       timeout: 5000,
  43  |     });
  44  |   });
  45  | 
  46  |   test('usuario puede cerrar sesión', async ({ page }) => {
  47  |     // Primero iniciar sesión
  48  |     await page.goto('/login.html');
  49  |     await page.fill('#email', 'test@test.com');
  50  |     await page.fill('#password', 'password');
  51  |     await page.click('button[type="submit"]');
  52  | 
  53  |     // Esperar a que cargue el dashboard
  54  |     await page.waitForURL(/.*dashboard/);
  55  | 
  56  |     // Hacer logout
  57  |     await page.click('text=Cerrar Sesión');
  58  | 
  59  |     // Verificar que redirige al login
  60  |     await expect(page).toHaveURL(/.*login/);
  61  |   });
  62  | });
  63  | 
  64  | test.describe('Dashboard y Menús', () => {
  65  |   test.beforeEach(async ({ page }) => {
  66  |     // Login antes de cada test
  67  |     await page.goto('/login.html');
  68  |     await page.fill('#email', 'test@test.com');
  69  |     await page.fill('#password', 'password');
  70  |     await page.click('button[type="submit"]');
  71  |     await page.waitForURL(/.*dashboard/);
  72  |   });
  73  | 
  74  |   test('dashboard carga los menús del usuario', async ({ page }) => {
  75  |     // Esperar a que carguen los menús
  76  |     await page.waitForSelector('#menuList li', { timeout: 5000 });
  77  | 
  78  |     // Verificar que hay al menos un elemento en el menú
  79  |     const menuItems = await page.locator('#menuList li').count();
  80  |     expect(menuItems).toBeGreaterThan(0);
  81  |   });
  82  | 
  83  |   test('menús tienen los atributos correctos', async ({ page }) => {
  84  |     await page.waitForSelector('#menuList li a', { timeout: 5000 });
  85  | 
  86  |     const menuLink = page.locator('#menuList li a').first();
  87  |     await expect(menuLink).toHaveAttribute('href', /.+/);
  88  |   });
  89  | 
  90  |   test('logout aparece en el menú', async ({ page }) => {
  91  |     await page.waitForSelector('text=Cerrar Sesión', { timeout: 5000 });
  92  |     await expect(page.locator('text=Cerrar Sesión')).toBeVisible();
  93  |   });
  94  | });
  95  | 
  96  | test.describe('Navegación protegida', () => {
  97  |   test('usuario no autenticado es redirigido al login', async ({ page }) => {
  98  |     await page.goto('/dashboard.html');
  99  | 
  100 |     // Verificar que redirige al login
  101 |     await expect(page).toHaveURL(/.*login/);
  102 |   });
  103 | 
  104 |   test('token inválido redirige al login', async ({ page, context }) => {
  105 |     // Guardar un token inválido
  106 |     await context.addInitScript(() => {
  107 |       localStorage.setItem('token', 'token-invalido');
  108 |       localStorage.setItem('user', JSON.stringify({ name: 'Test' }));
  109 |     });
  110 | 
  111 |     await page.goto('/dashboard.html');
```