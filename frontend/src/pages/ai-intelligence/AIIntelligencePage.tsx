import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { HROperationsCopilot } from '../../components/copilot/HROperationsCopilot';

export const AIIntelligencePage: React.FC = () => {
  const { tab = 'copilot' } = useParams<{ tab?: string }>();

  if (tab === 'predictions' || tab === 'actions') {
    return <Navigate to="/insights" replace />;
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <HROperationsCopilot />
    </div>
  );
};

export default AIIntelligencePage;
