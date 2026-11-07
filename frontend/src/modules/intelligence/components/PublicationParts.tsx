import { StarFilled, StarOutlined } from '@ant-design/icons';
import { App, Button, Tooltip } from 'antd';
import { type MouseEvent, useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { StatusBadge } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { useIntelligence } from '@/modules/intelligence/context';
import { RELEVANCE, relevanceSteps } from '@/modules/intelligence/format';
import type { Publication, Relevance } from '@/modules/intelligence/types';
import { colors, radius, tones } from '@/theme';

// o Tooltip precisa de um elemento DOM para ancorar
const TooltipAnchor = styled.span`
  display: inline-flex;
`;

const FavButton = styled(Button)<{ $active: boolean }>`
  &&& {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: ${radius.field}px;
    font-size: 14px;
    color: ${({ $active }) => ($active ? tones.warning.solid : colors.textSubtle)};
    background: ${({ $active }) => ($active ? tones.warning.bg : 'transparent')};
    border: 1px solid ${({ $active }) => ($active ? tones.warning.border : colors.border)};
  }

  &&&:hover,
  &&&:focus-visible {
    color: ${tones.warning.solid};
    border-color: ${tones.warning.border};
    background: ${tones.warning.bg};
  }
`;

/** Relevance badge on the shared semantic scale (no explanation). */
export function RelevanceBadge({ relevance }: { relevance: Relevance }) {
  const level = RELEVANCE[relevance];
  if (!level) return null;
  return <StatusBadge tone={level.tone}>{level.label}</StatusBadge>;
}

/** Relevance badge; hovering shows why it got this level. */
export function RelevanceTag({ publication }: { publication: Publication }) {
  const { subjectName } = useIntelligence();
  const level = RELEVANCE[publication.relevance];
  if (!level) return null;
  const steps = relevanceSteps(publication, subjectName);
  const badge = <RelevanceBadge relevance={publication.relevance} />;
  return steps ? (
    <Tooltip title={`Por que ${level.label}: ${steps.join(' · ')}`}>
      <TooltipAnchor>{badge}</TooltipAnchor>
    </Tooltip>
  ) : (
    badge
  );
}

// variante em texto ("☆ Favoritar"), usada nas linhas das listas
const FavTextButton = styled(Button)<{ $active: boolean }>`
  &&& {
    height: 22px;
    padding: 0 6px;
    font-size: 12px;
    font-weight: 500;
    color: ${({ $active }) => ($active ? tones.warning.solid : colors.textMuted)};
  }

  &&&:hover,
  &&&:focus-visible {
    color: ${tones.warning.solid};
    background: ${tones.warning.bg};
  }
`;

interface FavoriteButtonProps {
  publication: Publication;
  onChange: (publication: Publication) => void;
  /** "icon": square star button (detail); "text": star with "Favoritar"/"Favorito" (lists). */
  variant?: 'icon' | 'text';
}

export function FavoriteButton({ publication, onChange, variant = 'icon' }: FavoriteButtonProps) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);
  const label = publication.favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos';

  async function toggle() {
    if (saving) return;
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

  const active = Boolean(publication.favorite);
  const icon = active ? <StarFilled /> : <StarOutlined />;
  const onClick = (e: MouseEvent) => {
    e.stopPropagation();
    void toggle();
  };

  if (variant === 'text') {
    return (
      <FavTextButton type="text" size="small" $active={active} loading={saving} aria-label={label} aria-pressed={active} title={label} icon={icon} onClick={onClick}>
        {active ? 'Favorito' : 'Favoritar'}
      </FavTextButton>
    );
  }

  return (
    <Tooltip title={label}>
      <FavButton $active={active} loading={saving} aria-label={label} aria-pressed={active} icon={icon} onClick={onClick} />
    </Tooltip>
  );
}
