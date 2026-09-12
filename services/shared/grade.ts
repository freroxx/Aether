import { Attachment } from "@/services/shared/attachment";
import { GenericInterface } from "@/services/shared/types";
import { SkillChipLevel } from "@/ui/components/SkillChip";

export interface PeriodGrades extends GenericInterface {
  studentOverall: GradeScore;
  classAverage: GradeScore;
  subjects: Subject[];
  modules?: Subject[];
  rank?: GradeScore;
  features?: {
    [key: string]: any;
  };
}

export interface Subject {
  id: string;
  name: string;
  studentAverage?: GradeScore;
  classAverage: GradeScore;
  maximum?: GradeScore;
  minimum?: GradeScore;
  outOf: GradeScore;
  grades?: Grade[];
  credits?: GradeScore;
  rank?: GradeScore;
}

/** Parité pronotepy Util.grade_translate (|1..|8). */
export const GRADE_TRANSLATE = [
  "Absent",
  "Dispense",
  "NonNote",
  "Inapte",
  "NonRendu",
  "AbsentZero",
  "NonRenduZero",
  "Felicitations",
] as const;

export type GradeStatusCode = (typeof GRADE_TRANSLATE)[number] | string;

export interface Grade extends GenericInterface {
  id: string;
  subjectId: string;
  subjectName: string;
  description: string;
  comment?: string;
  isBonus?: boolean;
  isOptional?: boolean;
  isOutOf20?: boolean;
  givenAt?: Date;
  subjectFile?: Attachment;
  correctionFile?: Attachment;
  bonus?: boolean;
  optional?: boolean;
  outOf?: GradeScore;
  coefficient: number;
  studentScore?: GradeScore;
  averageScore?: GradeScore;
  minScore?: GradeScore;
  maxScore?: GradeScore;
  rank?: GradeScore;
  skills?: SkillScore[];
  /** Code backend brut (Absent/Dispense/NonNote/...) pour affichage localisé. */
  statusCode?: string | null;
  /** Valeur brute backend (ex. "|1", "Abs") quand status_code absent. */
  rawGrade?: string | null;
}

export interface SkillScore {
  name: string;
  description: string;
  score: string | SkillChipLevel;
}

export interface GradeScore {
  value: number;
  outOf?: number;
  status?: string;
  disabled?: boolean;
}

export interface Period extends GenericInterface {
  name: string
  id?: string
  start: Date
  end: Date
}

export interface Acquisition {
  id?: string | null;
  name: string;
  abbreviation: string;
  level: string;
  coefficient: number;
  domain: string;
  domainId?: string | null;
  nameId?: string | null;
  order?: number | null;
  pillar: string;
  pillarId?: string | null;
  pillarPrefix?: string | null;
}

export interface Evaluation extends GenericInterface {
  id: string;
  name: string;
  subject: string;
  subjectId?: string | null;
  domain?: string | null;
  teacher: string;
  coefficient: number;
  description: string;
  date?: Date;
  paliers: string[];
  acquisitions: Acquisition[];
}

export interface ReportSubject {
  id?: string | null;
  name: string;
  color?: string | null;
  comments: string[];
  classAverage?: number | null;
  studentAverage?: number | null;
  minAverage?: number | null;
  maxAverage?: number | null;
  coefficient?: number | null;
  teachers: string[];
}

export interface Report extends GenericInterface {
  comments: string[];
  subjects: ReportSubject[];
}