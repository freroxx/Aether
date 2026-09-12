export interface TeachingSubject {
  id?: string | null;
  name: string;
  parentSubjectId?: string | null;
  parentSubjectName?: string | null;
}

export interface TeachingStaff {
  id?: string | null;
  name: string;
  subject: string;
  subjects?: TeachingSubject[];
  type?: string | null;
  email: string;
}
