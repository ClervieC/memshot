import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'admin/login',
    loadComponent: () => import('./pages/admin/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin/reset-password',
    loadComponent: () => import('./pages/admin/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'admin/dashboard',
    loadComponent: () => import('./pages/admin/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard]
  },
  {
    path: 'admin/create-event',
    loadComponent: () => import('./pages/admin/create-event/create-event.component').then(m => m.CreateEventComponent),
    canActivate: [authGuard]
  },
  {
    path: 'event/:eventId',
    loadComponent: () => import('./pages/event/event.component').then(m => m.EventComponent)
  },
  {
    path: 'event/:eventId/camera',
    loadComponent: () => import('./pages/event/camera/camera.component').then(m => m.CameraComponent)
  },
  {
    path: 'event/:eventId/gallery',
    loadComponent: () => import('./pages/event/gallery/gallery.component').then(m => m.GalleryComponent)
  },
  { path: '**', redirectTo: '' }
];
