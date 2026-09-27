// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { Model } from '@nozbe/watermelondb';
import { children,field, relation } from "@nozbe/watermelondb/decorators";

import { GradeScore } from '@/services/shared/grade';

import { Grade, PeriodGrades } from './Grades';

export default class Subject extends Model {
  static table = 'subjects';

  static associations = {
    periodgrades: { type: 'belongs_to', key: 'periodGradeId' },
    grades: { type: 'has_many', foreignKey: 'subjectId' },
  };

  @field('name') name: string;
  @field('subjectId') subjectId: string;
  @field('studentAverage') studentAverageRaw: string;
  @field('classAverage') classAverageRaw: string;
  @field('maximum') maximumRaw: string;
  @field('minimum') minimumRaw: string;
  @field('outOf') outOfRaw: string;
  @field('periodGradeId') periodGradeId?: string;

  @relation('periodgrades', 'periodGradeId') periodGrade?: PeriodGrades;
  @children('grades') grades: Grade[];

  get studentAverage(): GradeScore {
    try { return JSON.parse(this.studentAverageRaw || '{}'); } catch { return {} as GradeScore; }
  }

  get classAverage(): GradeScore {
    try { return JSON.parse(this.classAverageRaw || '{}'); } catch { return {} as GradeScore; }
  }

  get maximum(): GradeScore {
    try { return JSON.parse(this.maximumRaw || '{}'); } catch { return {} as GradeScore; }
  }

  get minimum(): GradeScore {
    try { return JSON.parse(this.minimumRaw || '{}'); } catch { return {} as GradeScore; }
  }

  get outOf(): GradeScore {
    try { return JSON.parse(this.outOfRaw || '{}'); } catch { return {} as GradeScore; }
  }
}
