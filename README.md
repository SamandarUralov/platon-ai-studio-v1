# Platon AI Studio — frontend

Vue 3 + TypeScript monorepo. Reja va fazalar: [../docs/IMPLEMENTATION_PLAN.md](../docs/IMPLEMENTATION_PLAN.md) · paketlar: [../docs/PACKAGES.md](../docs/PACKAGES.md) · agentlar uchun qoidalar: [../AGENTS.md](../AGENTS.md).

## Ishga tushirish

```bash
nvm use            # Node 22
pnpm install
pnpm dev           # http://localhost:5173 — brauzer ichidagi mock backend (FieldOps demo) bilan
```

Mock backend [MSW](https://mswjs.io) orqali brauzerda ishlaydi va o'zgarishlarni `localStorage` da saqlaydi.
Demo ma'lumotlarni qayta tiklash: brauzer konsolida `__platonResetMocks()`.

Haqiqiy backend'ga ulash uchun `apps/studio/.env.local`:

```bash
VITE_USE_MOCKS=false
VITE_API_URL=https://studio-api.example.com
VITE_OIDC_AUTHORITY=https://keycloak.example.com/realms/platon
VITE_OIDC_CLIENT_ID=platon-studio
VITE_CONSTRUCTOR_ORIGIN=https://constructor.example.com
```

## Buyruqlar

| Buyruq                        | Vazifasi                                                |
| ----------------------------- | ------------------------------------------------------- |
| `pnpm dev`                    | Studio dev server                                       |
| `pnpm build`                  | Production build (`apps/*`)                             |
| `pnpm lint` / `pnpm lint:fix` | ESLint                                                  |
| `pnpm typecheck`              | Barcha paketlarda `vue-tsc`                             |
| `pnpm test`                   | Vitest (unit + store integratsiya testlari)             |
| `pnpm test:e2e`               | Playwright (dev server'ni o'zi ko'taradi)               |
| `pnpm gen:types`              | JSON Schema → TypeScript tiplar (`packages/definition`) |

## Tuzilma

```
apps/studio/          Studio SPA
  src/app/            main.ts, router, i18n, global styles
  src/layouts/        HomeLayout, StudioLayout (top bar + qatlam + konsol)
  src/components/     shell (TopBar, LayerShell, CommandPalette…) va common (SaveBar, ProblemsList, JsonView…)
  src/stores/         definition (optimistik patch, navbat, 409 rebase, undo/redo), drafts, session, ui
  src/features/       har bir qatlam o'z papkasida: routes.ts, komponentlar, locales/
packages/ui/          dizayn tokenlari + P* komponentlar (Reka UI ustida)
packages/definition/  JSON Schema, generatsiya qilingan tiplar, id-asosli JSON Patch, kataloglar, API DTO
packages/validators/  Problems paneli uchun tekshiruvlar (mock server ham ishlatadi)
packages/renderer/    Canvas, Preview va runtime uchun umumiy sahifa renderer
packages/bridge/      Studio ↔ Constructor iframe protokoli
mocks/                MSW handler'lar + FieldOps seed
e2e/                  Playwright testlari
```

## Asosiy qoidalar (qisqacha)

- Ta'rifdagi har bir o'zgarish `useDefinitionStore().apply({ key, area, text, ops })` orqali o'tadi.
- Mantiq elementlari va sahifa skriptlari draft modelida ishlaydi: `useDraftsStore()` → `⌘S` bilan saqlanadi.
- JSON Pointer'lar massiv elementlarini id bo'yicha topadi: `/logic/apis/post_work_orders/access/type`.
- Ranglar faqat tokenlar orqali (`bg-surface`, `text-muted`…), dark mode tokenlarni almashtiradi.
- Tezkor tugmalar faqat `useShortcuts()` orqali ro'yxatdan o'tadi.
