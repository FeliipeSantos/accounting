import { Modal } from 'antd';
import { useState } from 'react';

import { DocumentModal } from '@/modules/reforma/components/DocumentModal';
import { EventCard } from '@/modules/reforma/components/EventCard';
import { longDate } from '@/modules/reforma/format';
import type { CalendarEvent, Status } from '@/modules/reforma/types';

interface EventModalProps {
  event: CalendarEvent | null;
  status: Status;
  onClose: () => void;
}

/** The full card of one date; its document opens on top and, when closed, returns here. */
export function EventModal({ event, status, onClose }: EventModalProps) {
  const [document, setDocument] = useState<string | null>(null);
  const kindName = (kind: string) => status.eventKinds[kind] ?? kind;
  const subjectName = (id: string) => status.subjects.find((s) => s.id === id)?.name ?? id;
  const sourceName = (id: string) => status.sources.find((s) => s.id === id)?.name ?? id;
  const title = event ? longDate(event.date) : '';
  return (
    <>
      <Modal open={event !== null && document === null} onCancel={onClose} footer={null} width={720} title={title.charAt(0).toUpperCase() + title.slice(1)}>
        {event && <EventCard event={event} kindName={kindName} subjectName={subjectName} sourceName={sourceName} onOpenDocument={setDocument} />}
      </Modal>
      <DocumentModal documentId={document} sourceName={sourceName} kindName={(id) => status.kinds[id] ?? id} onClose={() => setDocument(null)} />
    </>
  );
}
