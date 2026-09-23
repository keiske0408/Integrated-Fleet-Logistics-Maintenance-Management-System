---
name: frontend
description: >-
  Covers React.js, Refine meta-framework integration, type-safe API data providers,
  form management with react-hook-form and Zod resolvers, component architecture,
  and state management. Use when creating or editing frontend pages, forms, hooks, or Refine resources.
---

# Frontend Architecture & Refine Skill

Provides structured guidance for building scalable, type-safe, and high-performance frontend interfaces using React, Refine, and shadcn/ui.

---

## 1. Single Source of Truth Architecture

```
Drizzle Schema ➔ Zod Validation ➔ OpenAPI Spec ➔ Generated Types ➔ Refine Data Provider & Forms
```

1. **Never Duplicate Shapes**:
   - Always import types from `src/api/generated-types.ts` or `src/db/validation.ts`.
   - Run `npm run api:spec` whenever schema fields change.
2. **Form Validation**:
   - Wire every form to its corresponding Zod schema via `zodResolver`:
   ```tsx
   import { useForm } from 'react-hook-form';
   import { zodResolver } from '@hookform/resolvers/zod';
   import { insertTsrfRequestSchema, InsertTsrfRequest } from '@/db/validation';

   const {
     register,
     handleSubmit,
     formState: { errors },
   } = useForm<InsertTsrfRequest>({
     resolver: zodResolver(insertTsrfRequestSchema),
   });
   ```

---

## 2. Refine Resource & Access Control Integration

1. **Resource Registration**:
   - Register modules in Refine `<Refine>` provider with standard CRUD actions: `list`, `create`, `edit`, `show`.
2. **RBAC Guarding**:
   - Pass `createRefineAccessControlProvider(ability)` into Refine's `accessControlProvider`.
   - Wrap interactive buttons and conditional tabs with `<Can I="..." a="...">` from `components/auth/CanAccess.tsx`:
   ```tsx
   import { Can } from '@/components/auth/CanAccess';

   <Can I="approve" a="PurchaseRequisition">
     <Button onClick={handleApprovePr}>Approve PR</Button>
   </Can>;
   ```

---

## 3. Component Architecture & Best Practices

1. **Component Directory Structure**:
   - `components/ui/`: Base primitives (button, dialog, input, card, table). Copied directly, never npm installed.
   - `components/forms/`: Isolated, testable form components wired with schema resolvers.
   - `components/views/`: Refine list/table, detail/show, and edit page views.
2. **Performance & Clean Code**:
   - Keep components focused and modular (< 250 lines).
   - Memoize expensive calculations (`useMemo`) and callbacks (`useCallback`) when passing down to heavy data tables.
   - Use skeleton loaders instead of jarring layout shifts during data loading.
