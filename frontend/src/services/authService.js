import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase/client";

export async function loginWithUniversityId(universityId, password) {
  if (!/^\d{6}$/.test(universityId)) {
    throw new Error("La matricola deve contenere 6 cifre.");
  }

  const email = `${universityId}@uniroom.test`;

  const result = await signInWithEmailAndPassword(auth, email, password);

  /*console.log("User logged in:", result.user); stampa tutti i dati user di firebase */
  return result.user;

}

export function logout() {
  return signOut(auth);
}