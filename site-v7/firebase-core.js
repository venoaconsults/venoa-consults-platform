import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendEmailVerification, sendPasswordResetEmail, reload, GoogleAuthProvider,
  signInWithPopup, signInWithRedirect, getRedirectResult, reauthenticateWithCredential,
  EmailAuthProvider, reauthenticateWithPopup, deleteUser
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

export const firebaseConfig = {
  apiKey: "AIzaSyCXfdLCO3sxSNQ49qHY7aSazMaaJ1tIH-U",
  authDomain: "venoa-constuls.firebaseapp.com",
  projectId: "venoa-constuls",
  storageBucket: "venoa-constuls.firebasestorage.app",
  messagingSenderId: "250635730686",
  appId: "1:250635730686:web:db8a4970e8921703f62faf",
  measurementId: "G-TYKX0SQQXK"
};

export const SUPER_ADMIN_USERNAME = "admin";
export const SUPER_ADMIN_EMAIL = "venoaconsults@gmail.com";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, reload, signInWithPopup, signInWithRedirect,
  getRedirectResult, reauthenticateWithCredential, EmailAuthProvider, reauthenticateWithPopup,
  deleteUser, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, collection, getDocs,
  serverTimestamp, query, where, ref, uploadBytes, getDownloadURL, deleteObject
};

export function isSuperAdminUser(user) {
  return Boolean(
    user &&
    user.email &&
    user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified
  );
}

export async function ensureCreatorProfile(user, source = "email") {
  const profileRef = doc(db, "creatorProfiles", user.uid);
  const snap = await getDoc(profileRef);
  if (!snap.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || "",
      emailVerified: Boolean(user.emailVerified),
      authProvider: source,
      accountStatus: "ACTIVE",
      applicationStatus: "NOT_SUBMITTED",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(profileRef, {
      email: user.email || snap.data().email || "",
      emailVerified: Boolean(user.emailVerified),
      updatedAt: serverTimestamp()
    });
  }
}

export async function audit(action, details = {}) {
  const user = auth.currentUser;
  if (!isSuperAdminUser(user)) return;
  await addDoc(collection(db, "auditLogs"), {
    action,
    actorUid: user.uid,
    actorEmail: user.email,
    details,
    createdAt: serverTimestamp()
  });
}

export async function listCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function cleanData(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") return value.trim();
  return value;
}
