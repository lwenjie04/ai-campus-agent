import { defineStore } from 'pinia'

export const useProfileStore = defineStore('mobile-profile', {
  state: () => ({
    role: 'student',
    grade: '',
    major: '',
  }),
  actions: {
    setProfile(payload: Partial<{ role: string; grade: string; major: string }>) {
      this.role = payload.role ?? this.role
      this.grade = payload.grade ?? this.grade
      this.major = payload.major ?? this.major
    },
  },
})
