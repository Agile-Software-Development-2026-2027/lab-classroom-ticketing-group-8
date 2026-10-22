# Services — Development Guide

## Purpose

The `services/` directory contains the JavaScript functions responsible for communicating with Firebase.

React components should not directly manage Firestore queries or Firebase Authentication operations. Instead, they should import functions from the appropriate service.

This separation makes the application easier to maintain, test, and extend.

## Project Architecture

**React Pages / Components → JavaScript Services → Firebase SDK → Firebase Authentication / Cloud Firestore**

Firebase is accessed directly using the official JavaScript SDK. No custom REST backend is required for the current MVP.



## Development Rules

1. Export reusable asynchronous functions from service files.
2. Import the shared `auth` and `db` instances from `../firebase/client`.
3. Use Firestore queries such as `where()`, `orderBy()` and `limit()` rather than downloading entire collections unnecessarily.
4. Do not initialize Firebase again inside services.
5. Do not access the database directly inside React components unless there is a documented reason.
6. Handle asynchronous errors using `try/catch` at the appropriate layer.
7. Do not store passwords inside Firestore.
8. Do not trust user IDs, booking statuses or administrative roles supplied by the browser.
9. Keep services independent of React components whenever possible.
10. Update Firestore Security Rules and indexes when a Story requires new data access.

## Example Usage

A future `usersService.js` may expose a function named `getUsersByRole(role)`.

A React component will then be able to call:

`const professors = await getUsersByRole("professor");`

Filtering takes place in Firestore, subject to the database's Security Rules.

## Security Requirements

Firestore Security Rules are responsible for enforcing access permissions.

- Professors may access only the information authorized for their role.
- Administrative actions must be restricted to verified administrators.
- Users must never be allowed to assign themselves the administrator role.
- Booking ownership must be validated.
- Booking approval, rejection and prevention of conflicting reservations require server-enforced safeguards.

**Important:** JavaScript service validation improves code organization but is not a security boundary.

