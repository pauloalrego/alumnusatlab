import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProfileBySlug } from '../api';
import { getTokenPayload } from '../auth';
import { useAppLayout } from '../components/AppLayout';
import MilestoneTimeline from '../components/MilestoneTimeline';

const STATUS_LABELS = { graduacao: 'Graduação', mestrado: 'Mestrado', doutorado: 'Doutorado', postdoc: 'Pós-doc', professor: 'Professor', egresso: 'Egresso' };
const STATUS_COLORS = { graduacao: '#3B82F6', mestrado: '#F59E0B', doutorado: '#10B981', postdoc: '#06B6D4', professor: '#7C3AED', egresso: '#6B7280' };

export default function MilestonesPage() {
  const { slug } = useParams();
  const [profile, setProfile] = useState(null);
  const { setProfileTopbar } = useAppLayout();

  const payload      = getTokenPayload();
  const isOwnProfile = profile?.user?.id != null && Number(payload?.sub) === Number(profile.user.id);
  const isProfessor  = payload?.role === 'professor' || payload?.role === 'superadmin';
  const canEdit      = isProfessor || isOwnProfile;

  useEffect(() => {
    if (slug) getProfileBySlug(slug).then(setProfile);
  }, [slug]);

  useEffect(() => {
    if (!profile?.user) return;
    const user       = profile.user;
    const researcher = profile.researcher;
    const color      = STATUS_COLORS[researcher?.status] || '#6B7280';
    setProfileTopbar({
      nome:          user.nome,
      photoUrl:      user.photo_url || null,
      statusColor:   color,
      statusLabel:   researcher ? (STATUS_LABELS[researcher.status] || researcher.status) : (user.role === 'professor' ? 'Professor' : 'Usuário'),
      email:         researcher?.email || user.email,
      lastLoginLine: null,
      onAvatarClick: null,
      uploadingPhoto: false,
      hideSettings:  true,
    });
    return () => setProfileTopbar(null);
  }, [profile, setProfileTopbar]);

  const nome = profile?.user?.nome ?? '';

  return (
    <div className="min-h-full bg-gray-50">
      <main className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Link to={`/app/profile/${slug}`} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Perfil
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-800">🏁 Marcos temporais{nome ? ` de ${nome}` : ''}</h1>
        </div>
        {profile?.user && (
          <MilestoneTimeline
            userId={profile.user.id}
            researcher={profile.researcher}
            canEdit={canEdit}
            alwaysOpen
          />
        )}
      </main>
    </div>
  );
}
