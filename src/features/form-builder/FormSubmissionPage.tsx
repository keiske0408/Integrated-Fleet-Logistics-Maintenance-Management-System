import { useParams } from 'react-router-dom';
import { TSRFSubmissionTracker } from './TSRFSubmissionTracker';
import { TSRFDetailView } from './TSRFDetailView';

export function FormSubmissionPage() {
  const { formKey = 'tsrf', id } = useParams<{ formKey: string; id?: string }>();
  if (id) return <TSRFDetailView id={id} />;
  return <TSRFSubmissionTracker key={formKey} formKey={formKey} refreshToken={0} />;
}
