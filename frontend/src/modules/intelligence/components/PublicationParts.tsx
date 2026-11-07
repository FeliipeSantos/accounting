import { StarFilled, StarOutlined } from '@ant-design/icons';
import { App, Button, Tag, Tooltip } from 'antd';
import { useState } from 'react';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { intelligenceApi } from '@/modules/intelligence/api';
import { useIntelligence } from '@/modules/intelligence/context';
import { RELEVANCE, relevanceSteps } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';

/** Relevance badge; hovering shows why it got this level. */
export function RelevanceTag({ publication }: { publication: Publication }) {
  const { subjectName } = useIntelligence();
  const level = RELEVANCE[publication.relevance];
  if (!level) return null;
  const steps = relevanceSteps(publication, subjectName);
  const tag = <Tag color={level.color}>{level.label}</Tag>;
  return steps ? <Tooltip title={`Por que ${level.label}: ${steps.join(' · ')}`}>{tag}</Tooltip> : tag;
}

interface FavoriteButtonProps {
  publication: Publication;
  onChange: (publication: Publication) => void;
  size?: 'small' | 'middle';
}

export function FavoriteButton({ publication, onChange, size = 'small' }: FavoriteButtonProps) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const label = publication.favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos';

  async function toggle() {
    setSaving(true);
    try {
      if (publication.favorite) await intelligenceApi.removeFavorite(publication.id);
      else await intelligenceApi.addFavorite(publication.id);
      onChange({ ...publication, favorite: !publication.favorite });
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível atualizar o favorito: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Tooltip title={label}>
      <Button
        type="text"
        size={size}
        loading={saving}
        aria-label={label}
        aria-pressed={Boolean(publication.favorite)}
        icon={publication.favorite ? <StarFilled /> : <StarOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
      />
    </Tooltip>
  );
}
