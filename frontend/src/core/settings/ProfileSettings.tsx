import { CameraOutlined, CheckCircleFilled, EditOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Modal } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/authContext';
import { type AvatarChoice, displayName, type Profile, profileApi } from '@/core/auth/profile';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { useLoad } from '@/core/hooks/useLoad';
import { About, Panel, Row } from '@/core/settings/layout';
import { ErrorState, IconCircle, LoadingState } from '@/core/ui';
import { initials, usePresetUri } from '@/core/ui/avatar';
import { UserAvatar } from '@/core/ui/UserAvatar';
import { colors } from '@/theme';

/** Same rules as the server (app/core/users.py and app/core/profile.py). */
const MIN_PASSWORD_LENGTH = 10;
const MAX_NAME_LENGTH = 80;
// o login é sempre o e-mail (o servidor guarda em minúsculas)
const EMAIL_PATTERN = /^[\w.+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// a foto é reduzida no navegador antes de enviar: o avatar nunca aparece maior que isto
const PHOTO_SIZE = 256;

// ── Linhas do quadro ────────────────────────────────────────────────────────────────────────

const Identity = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
`;

const IdentityTexts = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;

  strong {
    font-size: 16px;
    font-weight: 600;
    color: ${colors.navy};
    overflow-wrap: anywhere;
  }

  span {
    font-size: 13px;
    color: ${colors.textMuted};
    overflow-wrap: anywhere;
  }
`;

const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

const Note = styled.p<{ $spaced?: boolean }>`
  margin: 0 0 ${({ $spaced }) => ($spaced ? 16 : 0)}px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

const Facts = styled.dl`
  margin: 0;
  display: flex;
  flex-direction: column;
`;

const Fact = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;

  &:first-child {
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  & + & {
    border-top: 1px solid ${colors.border};
  }

  dt {
    font-size: 13.5px;
    font-weight: 500;
    color: ${colors.textDark};
  }

  dd {
    margin: 2px 0 0;
    font-size: 12.5px;
    color: ${colors.textMuted};
  }
`;

const FactValue = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 13.5px;
  font-weight: 500;
  color: ${colors.textDark};
  white-space: nowrap;
  text-align: right;
`;

// ── Modal de edição ─────────────────────────────────────────────────────────────────────────

const FieldsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;

  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const AvatarGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
  gap: 8px;
`;

const AvatarOption = styled.button<{ $selected: boolean }>`
  position: relative;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: ${colors.bgSubtle};
  color: ${colors.textMuted};
  font-size: 16px;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: ${colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  ${({ $selected }) =>
    $selected &&
    css`
      border-color: ${colors.blue};

      &:hover {
        border-color: ${colors.blue};
      }
    `}
`;

const Selected = styled(CheckCircleFilled)`
  position: absolute;
  top: -4px;
  right: -4px;
  font-size: 16px;
  color: ${colors.blue};
  background: ${colors.bgElevated};
  border-radius: 50%;
`;

const Hint = styled.div`
  margin-top: 8px;
  font-size: 12px;
  color: ${colors.textSubtle};
`;

const LinkButton = styled(Button)`
  &&& {
    padding-inline: 0;
  }
`;

const InitialsOption = styled.span`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: ${colors.blue};
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  text-transform: uppercase;
`;

/** Avatar chosen in the modal; "current-image" keeps the photo already on the server. */
type Choice = { kind: 'none' } | { kind: 'preset'; seed: string } | { kind: 'current-image'; url: string } | { kind: 'upload'; dataUrl: string };

function choiceOf(profile: Profile): Choice {
  if (profile.avatar?.kind === 'preset') return { kind: 'preset', seed: profile.avatar.seed };
  if (profile.avatar?.kind === 'image') return { kind: 'current-image', url: profile.avatar.url };
  return { kind: 'none' };
}

function toAvatarChoice(choice: Choice): AvatarChoice {
  if (choice.kind === 'preset') return { kind: 'preset', seed: choice.seed };
  if (choice.kind === 'current-image') return { kind: 'image' };
  if (choice.kind === 'upload') return { kind: 'upload', dataUrl: choice.dataUrl };
  return null;
}

/** Square crop of the photo, reduced to PHOTO_SIZE, as WebP (PNG where the browser has no WebP). */
async function shrinkPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível ler a imagem.');
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();
  const webp = canvas.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

function PresetOption({ seed, selected, onSelect }: { seed: string; selected: boolean; onSelect: () => void }) {
  const uri = usePresetUri(seed);
  return (
    <AvatarOption type="button" $selected={selected} aria-pressed={selected} aria-label={`Avatar ${seed.replace('avatar-', '')}`} onClick={onSelect}>
      {uri && <img src={uri} alt="" />}
      {selected && <Selected aria-hidden />}
    </AvatarOption>
  );
}

interface EditValues {
  name: string;
  username: string;
  currentPassword: string;
}

interface EditProfileModalProps {
  profile: Profile;
  open: boolean;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
}

function EditProfileModal({ profile, open, onClose, onSaved }: EditProfileModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm<EditValues>();
  const [choice, setChoice] = useState<Choice>(() => choiceOf(profile));
  const [seeds, setSeeds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const usernameLimit = useCharLimit('username', { showCount: false });
  const passwordLimit = useCharLimit('password', { showCount: false });
  const username: string | undefined = Form.useWatch('username', form);
  const name: string | undefined = Form.useWatch('name', form);
  const renaming = (username ?? profile.user).trim().toLowerCase() !== profile.user;

  // abre sempre com os dados salvos
  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: profile.name ?? '', username: profile.user, currentPassword: '' });
    setChoice(choiceOf(profile));
  }, [open, profile, form]);

  // as ilustrações carregam só quando o modal é aberto
  useEffect(() => {
    if (!open || seeds.length) return;
    void import('@/core/ui/avatarPresets').then(({ AVATAR_SEEDS }) => setSeeds(AVATAR_SEEDS));
  }, [open, seeds.length]);

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) {
      message.error('Escolha uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      message.error('A imagem passa de 5 MB.');
      return;
    }
    try {
      setChoice({ kind: 'upload', dataUrl: await shrinkPhoto(file) });
    } catch {
      message.error('Não foi possível ler a imagem.');
    }
  }

  async function submit(values: EditValues) {
    setSaving(true);
    let renamed = false;
    try {
      const newUsername = values.username.trim();
      if (newUsername.toLowerCase() !== profile.user) {
        await profileApi.changeUsername(values.currentPassword, newUsername);
        renamed = true;
      }
      const saved = await profileApi.update(values.name.trim(), toAvatarChoice(choice));
      onSaved(saved);
      message.success('Perfil atualizado.');
      onClose();
    } catch (error) {
      message.error(errorMessage(error));
      // o usuário já foi trocado mesmo que o resto falhe: a tela passa a mostrar o nome novo
      if (renamed) void profileApi.get().then(onSaved).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  }

  const photo = choice.kind === 'upload' ? choice.dataUrl : choice.kind === 'current-image' ? choice.url : profile.avatar?.kind === 'image' ? profile.avatar.url : null;
  const photoSelected = choice.kind === 'upload' || choice.kind === 'current-image';

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Editar perfil"
      width={520}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
          Atualizar
        </Button>,
      ]}
    >
      <Note $spaced>Atualize os seus dados de acesso e como você aparece no sistema.</Note>
      <Form<EditValues> form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <FieldsRow>
          <Form.Item label="Nome" name="name" rules={[{ max: MAX_NAME_LENGTH, message: `Use até ${MAX_NAME_LENGTH} caracteres` }]}>
            <Input placeholder={profile.user} maxLength={MAX_NAME_LENGTH} autoComplete="name" />
          </Form.Item>
          <Form.Item
            label="E-mail"
            name="username"
            rules={[
              { required: true, whitespace: true, message: 'Informe o e-mail' },
              { pattern: EMAIL_PATTERN, message: 'Informe um e-mail válido' },
            ]}
          >
            <Input type="email" autoComplete="email" inputMode="email" {...usernameLimit} />
          </Form.Item>
        </FieldsRow>

        {renaming && (
          <>
            <Form.Item
              label="Senha atual"
              name="currentPassword"
              extra="Para trocar o e-mail, confirme com a sua senha. Use o novo e-mail no próximo acesso."
              rules={[{ required: true, message: 'Confirme com a sua senha atual' }]}
            >
              <Input.Password autoComplete="current-password" {...passwordLimit} />
            </Form.Item>
          </>
        )}

        <Form.Item label="Avatar">
          <AvatarGrid role="group" aria-label="Avatar">
            <AvatarOption type="button" $selected={choice.kind === 'none'} aria-pressed={choice.kind === 'none'} aria-label="Iniciais" onClick={() => setChoice({ kind: 'none' })}>
              <InitialsOption>{initials(name?.trim() || username?.trim() || profile.user)}</InitialsOption>
              {choice.kind === 'none' && <Selected aria-hidden />}
            </AvatarOption>
            {seeds.map((seed) => (
              <PresetOption key={seed} seed={seed} selected={choice.kind === 'preset' && choice.seed === seed} onSelect={() => setChoice({ kind: 'preset', seed })} />
            ))}
            {photo && (
              <AvatarOption
                type="button"
                $selected={photoSelected}
                aria-pressed={photoSelected}
                aria-label="Sua foto"
                onClick={() => (choice.kind === 'upload' ? undefined : profile.avatar?.kind === 'image' && setChoice({ kind: 'current-image', url: profile.avatar.url }))}
              >
                <img src={photo} alt="" />
                {photoSelected && <Selected aria-hidden />}
              </AvatarOption>
            )}
            <AvatarOption type="button" $selected={false} aria-label="Enviar foto" title="Enviar foto" onClick={() => fileInput.current?.click()}>
              <CameraOutlined />
            </AvatarOption>
          </AvatarGrid>
          <Hint>JPG, PNG ou WebP de até 5 MB.</Hint>
        </Form.Item>
      </Form>
      {/* fora do formulário: o antd mostra todo input de arquivo dentro de um Form */}
      <input
        hidden
        ref={fileInput}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        onChange={(event) => {
          void pickPhoto(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </Modal>
  );
}

interface PasswordValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

function PasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<PasswordValues>();
  const [saving, setSaving] = useState(false);
  const passwordLimit = useCharLimit('password', { showCount: false });

  async function submit({ currentPassword, newPassword }: PasswordValues) {
    setSaving(true);
    try {
      await profileApi.changePassword(currentPassword, newPassword);
      message.success('Senha alterada. As outras sessões abertas foram encerradas.');
      onClose();
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Alterar senha"
      width={440}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>
          Cancelar
        </Button>,
        <Button key="save" type="primary" loading={saving} onClick={() => form.submit()}>
          Alterar senha
        </Button>,
      ]}
    >
      <Note $spaced>
        Use pelo menos {MIN_PASSWORD_LENGTH} caracteres. Você continua conectado aqui; as sessões abertas em outros lugares são encerradas.
      </Note>
      <Form<PasswordValues> form={form} layout="vertical" requiredMark={false} onFinish={submit} preserve={false}>
        <Form.Item label="Senha atual" name="currentPassword" rules={[{ required: true, message: 'Informe a senha atual' }]}>
          <Input.Password autoComplete="current-password" {...passwordLimit} />
        </Form.Item>
        <Form.Item
          label="Nova senha"
          name="newPassword"
          rules={[
            { required: true, message: 'Informe a nova senha' },
            { min: MIN_PASSWORD_LENGTH, message: `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres` },
          ]}
        >
          <Input.Password autoComplete="new-password" {...passwordLimit} />
        </Form.Item>
        <Form.Item
          label="Confirme a nova senha"
          name="confirmPassword"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Repita a nova senha' },
            ({ getFieldValue }) => ({
              validator: (_, value: string) =>
                !value || value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('As senhas não são iguais')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" {...passwordLimit} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** "Meu perfil" tab of Ajustes: who you are (name, login and avatar) and how you sign in. */
export function ProfileSettings() {
  const { setProfile } = useAuth();
  const loaded = useLoad(profileApi.get, []);
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  if (loaded.error) return <ErrorState message={loaded.error} onRetry={loaded.reload} />;
  const profile = loaded.data;
  if (!profile) return <LoadingState rows={4} />;

  function saved(next: Profile) {
    loaded.setData(() => next);
    setProfile(next);
  }

  return (
    <>
      <Panel aria-label="Meu perfil">
        <Row>
          <About>
            <IconCircle $tone="blue" $size={36} aria-hidden>
              <UserOutlined />
            </IconCircle>
            <div>
              <h2>Perfil</h2>
              <p>Como você aparece no sistema. O e-mail também identifica o seu acesso.</p>
            </div>
          </About>
          <Side>
            <Identity>
              <UserAvatar avatar={profile.avatar} name={displayName(profile)} size={56} />
              <IdentityTexts>
                <strong>{displayName(profile)}</strong>
                <span>{profile.user}</span>
              </IdentityTexts>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                Editar perfil
              </Button>
            </Identity>
            <Note>O e-mail exibido é o mesmo usado para entrar. Ao alterá-lo, use o novo endereço no próximo acesso.</Note>
          </Side>
        </Row>
        <Row>
          <About>
            <IconCircle $tone="blue" $size={36} aria-hidden>
              <KeyOutlined />
            </IconCircle>
            <div>
              <h2>Acesso</h2>
              <p>Resumo de como você entra no opencontabil.</p>
            </div>
          </About>
          <Facts>
            <Fact>
              <div>
                <dt>Formas de entrar</dt>
                <dd>E-mail e senha. Troque a senha sempre que precisar.</dd>
              </div>
              <FactValue>
                Senha
                <LinkButton type="link" size="small" onClick={() => setChangingPassword(true)}>
                  Alterar senha
                </LinkButton>
              </FactValue>
            </Fact>
            <Fact>
              <div>
                <dt>Conta criada em</dt>
                <dd>Data em que o seu acesso foi criado.</dd>
              </div>
              <FactValue>{dayjs(profile.createdAt).format('D [de] MMMM [de] YYYY')}</FactValue>
            </Fact>
          </Facts>
        </Row>
      </Panel>
      <EditProfileModal profile={profile} open={editing} onClose={() => setEditing(false)} onSaved={saved} />
      <PasswordModal open={changingPassword} onClose={() => setChangingPassword(false)} />
    </>
  );
}
