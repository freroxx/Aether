export interface StudentProfile {
  id?: string | null;
  name: string;
  className: string;
  establishment: string;
  address: string[];
  email: string;
  phone: string;
  ineNumber: string;
  delegue: string[];
  hasProfilePicture?: boolean;
}
