'use client';

import SingleChoice from '@/components/questions/SingleChoice';
import MultipleChoice from '@/components/questions/MultipleChoice';
import TextInput from '@/components/questions/TextInput';
import Matching from '@/components/questions/Matching';
import DragDrop from '@/components/questions/DragDrop';
import SelectFromList from '@/components/questions/SelectFromList';
import Ordering from '@/components/questions/Ordering';
import CodeEditor from '@/components/questions/CodeEditor';
import NumberPairs from '@/components/questions/NumberPairs';
import ImageFields from '@/components/questions/ImageFields';

interface Props {
  type: string;
  content: unknown;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

// Единый реестр компонентов вопросов (без free_form — чтобы исключить рекурсию
// при встраивании вопросов в «свободный формат»). Используется FreeForm для
// блоков типа 'question'.
export default function QuestionRenderer({ type, content, value, onChange, disabled }: Props) {
  const props = { content: content as never, value, onChange, disabled };
  switch (type) {
    case 'single_choice':   return <SingleChoice {...props} />;
    case 'multiple_choice': return <MultipleChoice {...props} />;
    case 'text_input':      return <TextInput {...props} />;
    case 'matching':        return <Matching {...props} />;
    case 'drag_drop':       return <DragDrop {...props} />;
    case 'select_list':     return <SelectFromList {...props} />;
    case 'ordering':        return <Ordering {...props} />;
    case 'code':            return <CodeEditor {...props} />;
    case 'number_pairs':    return <NumberPairs {...props} />;
    case 'image_fields':    return <ImageFields {...props} />;
    default:
      return <p className="t-body">Неизвестный тип вопроса</p>;
  }
}
