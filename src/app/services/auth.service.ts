import { Injectable, inject } from '@angular/core';
import {
  Auth,
  authState,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  User
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { switchMap, map, take, catchError, shareReplay, distinctUntilChanged } from 'rxjs/operators';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  photoURL?: string;
  createdAt: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);

  private profileSubject = new BehaviorSubject<UserProfile | null>(null);

  currentUser$ = authState(this.auth).pipe(
    distinctUntilChanged((prev, curr) => prev?.uid === curr?.uid)
  );

  userProfile$ = this.currentUser$.pipe(
    switchMap(user => {
      if (user) {
        // Only fetch from Firestore if we don't have it or it's a different user
        const currentCache = this.profileSubject.value;
        if (currentCache && currentCache.uid === user.uid) {
          return of(currentCache);
        }

        return from(this.getUserProfile(user.uid)).pipe(
          map(profile => {
            this.profileSubject.next(profile);
            return profile;
          }),
          catchError(err => {
            console.error('Error fetching profile over Firestore:', err);
            this.profileSubject.next(null);
            return of(null);
          })
        );
      } else {
        this.profileSubject.next(null);
        return of(null);
      }
    }),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  async register({ email, password, fullName }: any) {
    const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
    await updateProfile(userCredential.user, { displayName: fullName });

    const profile: UserProfile = {
      uid: userCredential.user.uid,
      fullName: fullName,
      email: email,
      createdAt: serverTimestamp(),
      photoURL: userCredential.user.photoURL || ''
    };

    await this.saveUserProfile(profile);
    this.profileSubject.next(profile);
    this.router.navigate(['/calculator']);
    return userCredential;
  }

  async loginWithEmail({ email, password }: any) {
    const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    this.router.navigate(['/calculator']);
    return userCredential;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(this.auth, provider);
    const user = userCredential.user;

    // Check if profile exists, if not create it
    const profileDoc = await this.getUserProfile(user.uid);
    if (!profileDoc) {
      const profile: UserProfile = {
        uid: user.uid,
        fullName: user.displayName || 'Usuario de Google',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp()
      };
      await this.saveUserProfile(profile);
      this.profileSubject.next(profile);
    } else {
      this.profileSubject.next(profileDoc);
    }

    this.router.navigate(['/calculator']);
    return userCredential;
  }

  async logout() {
    await signOut(this.auth);
    this.profileSubject.next(null);
    this.router.navigate(['/login']);
  }

  private async saveUserProfile(profile: UserProfile) {
    const userDocRef = doc(this.firestore, `users/${profile.uid}`);
    return setDoc(userDocRef, profile);
  }

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  }

  async updateProfileData(uid: string, data: Partial<UserProfile>) {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await updateDoc(userDocRef, data);

    // Update local cache to avoid re-fetching
    const current = this.profileSubject.value;
    if (current && current.uid === uid) {
      this.profileSubject.next({ ...current, ...data });
    }
  }
}
