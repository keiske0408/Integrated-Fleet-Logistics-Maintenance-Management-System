# Integrated Fleet Logistics & Maintenance Management System

A unified, full-stack digital platform designed to modernize and centralize vehicle operations, maintenance tracking, and logistics procurement across the organization.

---

## 🛠️ Tech Stack

### Frontend

- **[React.js 19](https://react.dev/)** – Modern library for building reactive and component-driven user interfaces.
- **[shadcn/ui](https://ui.shadcn.com/)** – Accessible, customizable component primitives built with Radix UI and Tailwind CSS.
- **[React Router 7](https://reactrouter.com/)** – Client-side routing with code-splitting and role-based route protection.

### Backend & API

- **[Node.js](https://nodejs.org/)** – Scalable server-side JavaScript runtime environment.
- **[Express.js](https://expressjs.com/)** – Fast, minimalist web framework for crafting robust RESTful APIs and middleware pipelines.

### Database & ORM

- **[PostgreSQL](https://www.postgresql.org/)** – Reliable, enterprise-grade relational database management system.
- **[Drizzle ORM](https://orm.drizzle.team/)** – Type-safe, lightweight TypeScript ORM offering performance and seamless schema migrations.

### Security

- **[Arcjet](https://arcjet.com/)** – Application security layer offering rate limiting, bot detection, attack protection, and request security analysis.
- **[CASL](https://casl.js.org/)** – Server-authoritative declarative authorization and attribute-based permissions.
- **[Argon2id](https://github.com/ranisalt/node-argon2)** – Next-generation password hashing for persistent local credentials.

---

## 🚀 Key Modules & Capabilities

- **Module A: Transportation Service Request (TSRF) & Logistics**
  - Digital request intake and 4:00 PM cutoff enforcement.
  - Multi-stop routing, location management, and passenger/driver manifests.
  - Multi-level department approval workflows.

- **Module B: Fleet Maintenance & Repair**
  - Real-time vehicle mileage (KM) tracking and digital fleet inventory.
  - Automated Preventive Maintenance Service (PMS) triggers based on 5,000 KM intervals.
  - Maintenance validation and incident/damage reporting for skipped PMS.

- **Module C: PR Gating & Procurement Engine**
  - Mandatory Purchase Requisition (PR) approval gating before work orders are unlocked.
  - Procurement sync and repair expenditure controls.

---

## 📖 Architecture & Implementation Roadmap

- **[Master Audit & Implementation Roadmap](docs/AUDIT_AND_IMPLEMENTATION_ROADMAP.md)** – Comprehensive multidisciplinary audit findings, prioritized update sequence (P0–P3), sprint-ready engineering tickets (FLEET-101 to FLEET-106), and strategic decisions.
- **[Frontend Architecture Guide](ARCHITECTURE.md)** – Domain-driven feature slicing, component conventions, and permissions.
- **[Project Context & Engineering Standards](PROJECT_CONTEXT.md)** – Coding rules, debugging discipline, single source of truth contracts, and update flow.
- **[Hybrid Authentication Guide](docs/HYBRID_AUTH.md)** – Dual Entra ID and persistent local credential architecture, admin bootstrap, and session management.
- **[Fleet Domain Rules](docs/FLEET_DOMAIN_RULES.md)** – Specific business rules governing PMS intervals, PR locks, and cutoff timing.
