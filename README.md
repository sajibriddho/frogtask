# Frogtask

> Eat the frog, own the day.

Frogtask is an open-source, self-hostable productivity app for planning your day and staying on top of your daily and recurring to-dos. This repository contains the full source — clone it, point it at your own MongoDB, and run a private instance for yourself or your team.

> **Looking for the hosted version?** If you just want to use Frogtask as an end-user, sign up on the hosted service — you don't need anything from this repo. The instructions below are for developers running their own instance.

---

## Features

### Dashboard

Your at-a-glance home screen. See where your day stands and what's coming up across your tasks.

### Today's Tasks

A single focused view of everything you need to handle today. Tick items off, reopen them, or add quick remarks as you go.

### Task Management

- **All Tasks** — the full list of your personal tasks, including recurring (daily / weekly) and one-off items.
- **Task Calendar** — a month-at-a-glance calendar of your tasks. Click any day to see the full breakdown.

> Project boards (Kanban) are in development and will land in a future release.

### Admin

When you self-host, the first seeded account is the **System Admin** for your instance. From there you can:

- **Users** — invite, manage, and deactivate users on your workspace.
- **Roles** — create custom roles and control exactly what each role can see and do, down to the menu and action level.
- **Settings** — workspace branding (name, logo, colours), email (SMTP) configuration, and other system preferences.

### Your profile

Each user can update their name, change their password, and manage their personal account from the profile menu.

---

## Tech stack

| Layer      | Choice                                         |
| ---------- | ---------------------------------------------- |
| Framework  | [Next.js 16](https://nextjs.org/) (App Router) |
| UI         | React 19, Tailwind CSS v4, Radix UI, shadcn/ui |
| Forms      | React Hook Form + Zod                          |
| Auth       | NextAuth v4 (Credentials provider)             |
| Database   | MongoDB + Mongoose                             |
| Email      | Nodemailer (SMTP)                              |
| Charts     | Recharts                                       |
| Animations | Framer Motion                                  |
| Language   | TypeScript                                     |

---

## Self-host setup

### Prerequisites

- Node.js **>= 20**
- A MongoDB instance — local (`mongodb://127.0.0.1:27017/frogtask`) or [MongoDB Atlas](https://www.mongodb.com/atlas)
- (Optional) An SMTP account if you want password-reset emails to actually send

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/frogtask.git
cd frogtask
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
NEXTAUTH_SECRET=   # generate with: openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
MONGODB_URI=mongodb://127.0.0.1:27017/frogtask
```

If you use MongoDB Atlas, remember to add your machine's IP to the cluster's **Network Access** allowlist — otherwise the connection will hang and time out.

### 3. Seed the database

This creates the permission tree, the two system roles (System Admin, General User), and a default admin user.

```bash
npm run seed
```

**Default admin credentials** (change immediately after first login):

```
Email:    admin@example.com
Password: 123456
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in.

### 5. Going to production

For a real deployment:

```bash
npm run build
npm run start
```

Set `NEXTAUTH_URL` to your public URL, generate a fresh `NEXTAUTH_SECRET`, and put `.env.local` (or the equivalent environment variables) on the server. Never commit secrets.

---

## Scripts

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                        |
| `npm run build`      | Production build                                    |
| `npm run start`      | Run the production build                            |
| `npm run lint`       | Lint with ESLint                                    |
| `npm run type-check` | Type-check with `tsc --noEmit`                      |
| `npm run seed`       | Seed permissions, roles, and the default admin user |

---

## Contributing

Issues and pull requests are welcome. If you're planning a larger change, open an issue first so we can talk through the approach before you spend time on it.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

## License

[MIT](LICENSE) © Sajib Sarker
