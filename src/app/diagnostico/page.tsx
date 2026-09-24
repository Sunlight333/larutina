import type { Metadata } from 'next'
import { DiagnosisFlow, type PublicQuestion } from '@/components/diagnosis/diagnosis-flow'
import { questions } from '@/lib/diagnosis/questions'

export const metadata: Metadata = {
  title: 'Diagnóstico de piel',
  description: 'Seis preguntas para armar tu rutina de mañana y de noche.',
}

// Weights never reach the browser: the client gets prompts and options only.
const publicQuestions: PublicQuestion[] = questions.map(({ key, prompt, help, type, max, options }) => ({
  key,
  prompt,
  help,
  type,
  max,
  options: options.map(({ value, label }) => ({ value, label })),
}))

export default function DiagnosisPage() {
  return (
    <div className="container-page max-w-2xl pt-6 pb-10 sm:pt-12">
      <DiagnosisFlow questions={publicQuestions} />
    </div>
  )
}
