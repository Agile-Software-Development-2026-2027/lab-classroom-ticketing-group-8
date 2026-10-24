import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client";

export async function getUserProfile(uid) {
  const reference = doc(db, "users", uid);
  const snapshot = await getDoc(reference);

  if (!snapshot.exists()) {
    throw new Error("Profilo non trovato.");
  }
  
  //console.log("User profile data:", snapshot.data()); user profile data: email,role,displayName,universityId
  return snapshot.data();
}