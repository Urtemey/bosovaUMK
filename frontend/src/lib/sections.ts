// Подразделы внутри классов (БУ/УУ/ВПР/ОГЭ/ЕГЭ) и класс СПО.
// Должно соответствовать backend/app/models/test.py (SECTIONS_BY_GRADE).

// СПО хранится отдельным значением grade (не входит в сетку 5-11).
export const SPO_GRADE = 12;

export const GRADES = [5, 6, 7, 8, 9, 10, 11, SPO_GRADE];

// Короткая подпись подраздела.
export const SECTION_LABELS: Record<string, string> = {
  bu: 'БУ',
  uu: 'УУ',
  vpr: 'ВПР',
  oge: 'ОГЭ',
  ege: 'ЕГЭ',
};

// Полная подпись (для подсказок).
export const SECTION_FULL: Record<string, string> = {
  bu: 'Базовый уровень',
  uu: 'Углублённый уровень',
  vpr: 'ВПР',
  oge: 'ОГЭ',
  ege: 'ЕГЭ',
};

// Допустимые подразделы по классам. Классы без записи (5, 6, 10, СПО)
// не делятся на подразделы.
export const SECTIONS_BY_GRADE: Record<number, string[]> = {
  7: ['bu', 'uu', 'vpr'],
  8: ['bu', 'uu', 'vpr'],
  9: ['bu', 'uu', 'oge'],
  11: ['bu', 'uu', 'ege'],
};

export function gradeSections(grade: number): string[] {
  return SECTIONS_BY_GRADE[grade] || [];
}

export function gradeLabel(grade: number): string {
  return grade === SPO_GRADE ? 'СПО' : `${grade} класс`;
}

// Короткая подпись для пилюли-кнопки класса.
export function gradePillLabel(grade: number): string {
  return grade === SPO_GRADE ? 'СПО' : String(grade);
}
