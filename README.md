# UniRoom - Classroom Booking System

UniRoom is a web application for managing university
classroom reservations.

Professors can request classrooms, while administrators
can approve or reject booking requests.

## How we work

- `main` is protected: nobody can push to it, every change goes through a pull request.
- Branches are short-lived (less than a day) and pull requests are small (less than 200 lines).
- A pull request needs the approval of a teammate and a green CI, and must be up to date with
  `main`. It is merged with a squash merge.
- The backlog and the sprints are on the Jira board of the team, not in this repository.
- The title of a pull request starts with the key of the Jira issue it implements:
  `ABC-12 Add the login form`.
- If `main` is red, fixing it comes before anything else.

## CI

`.github/workflows/ci.yml` runs build, lint, and separate test jobs for the stories on
pull requests. Story 51 runs the confirmation email tests with mocked Firebase and email
services, so it needs no EmailJS credentials or emulator.


## Sprint 1 Scope

The MVP includes:

1. Login for professors and administrators.
2. Identification of the authenticated user's role.
3. Submission of a simple classroom booking request.
4. Viewing booking requests.
5. Acceptance or rejection of booking requests by an administrator.

## Prerequisites

Before starting, install:

- Node.js 24 (recommended for the current project)
- npm

Firebase Console access is needed only for team members responsible for configuring or managing Firebase resources.

## Getting Started

### 1. Clone the Repository

`git clone <repository-url>`

`cd <repository-name>`

### 2. Install Dependencies

From the repository root:

`npm --prefix frontend ci`

This installs the dependencies specified in `frontend/package-lock.json`.

### 3. Configure Firebase

Copy the example environment file:

**Windows PowerShell:**

`Copy-Item frontend/.env.example frontend/.env.local`

Open `frontend/.env.local` and replace the placeholder values with the team's Firebase Web App configuration.

The required variables are:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`


### EmailJS approval notifications

1. Create an EmailJS account and connect the dedicated sender mailbox as an email service.
2. Create an approval template. Set its recipient to `{{to_email}}` and use the variables
   `professor_name`, `classroom_name`, `booking_date`, `start_time`, and `end_time` in its content.
3. Copy the service ID, approval template ID, and EmailJS Public Key into `frontend/.env.local`:

```env
VITE_EMAILJS_IS_ACTIVE=false
VITE_EMAILJS_SERVICE_ID=your_service_id
VITE_EMAILJS_TEMPLATE_ACCEPTANCE_ID=your_approval_template_id
VITE_EMAILJS_PUBLIC_KEY=your_public_key
```

Keep `VITE_EMAILJS_IS_ACTIVE=false` for routine development. Set it to `true` only when
checking real delivery and restart the development server after changing it. Each local
environment controls its own setting; for deployment, configure the value before building.

The destination is `contactEmail` in the professor profile at `users/<UID>`. Use the tester's
real inbox there. The login `email` keeps the `<six-digit-universityId>@uniroom.test` format.
The Authentication account and the Firestore profile must use the same UID.

The sender mailbox credentials are managed through the EmailJS connection. Keep the actual
local configuration in the ignored `.env.local`; `.env.example` contains placeholders.

Run the two mocked notification tests from the repository root:

```sh
npm --prefix frontend run test -- src/tests/UNITICKET-51.test.js
```

These tests do not send real emails or consume EmailJS requests.

### 4. Start the Development Server

From the repository root:

`npm --prefix frontend run dev`

Open the local URL displayed in the terminal, usually:

`http://localhost:5173`

