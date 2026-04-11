import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import GraphPage from './pages/GraphPage';
import ResearcherPage from './pages/ResearcherPage';
import RemindersPage from './pages/RemindersPage';
import ManualPage from './pages/ManualPage';
import ManualDetailPage from './pages/ManualDetailPage';
import DeadlinesPage from './pages/DeadlinesPage';
import AdminPage from './pages/AdminPage';
import InstitutionPage from './pages/InstitutionPage';
import AuthPage from './pages/AuthPage';
import LandingPage from './pages/LandingPage';
import ReadingsPage from './pages/ReadingsPage';
import MilestonesPage from './pages/MilestonesPage';
import NotesPage from './pages/NotesPage';
import PlanPage from './pages/PlanPage';
import ActivityPage from './pages/ActivityPage';


export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/entrar" element={<AuthPage />} />
      <Route path="/login" element={<Navigate to="/entrar" replace />} />
      <Route path="/register" element={<Navigate to="/entrar?tab=cadastro" replace />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Navigate to="group" replace />} />
        <Route
          path="group"
          element={
            <ProtectedRoute>
              <GraphPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="manual"
          element={
            <ProtectedRoute>
              <ManualPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="manual/:id"
          element={
            <ProtectedRoute>
              <ManualDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/:slug"
          element={
            <ProtectedRoute>
              <ResearcherPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/:slug/readings"
          element={
            <ProtectedRoute>
              <ReadingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/:slug/milestones"
          element={
            <ProtectedRoute>
              <MilestonesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile/:slug/notes"
          element={
            <ProtectedRoute>
              <NotesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reminders"
          element={
            <ProtectedRoute>
              <RemindersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="deadlines"
          element={
            <ProtectedRoute>
              <DeadlinesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="plan"
          element={
            <ProtectedRoute>
              <PlanPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="activity"
          element={
            <ProtectedRoute>
              <ActivityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="institutions"
          element={
            <ProtectedRoute adminOnly>
              <InstitutionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Route>
    </Routes>
  );
}
