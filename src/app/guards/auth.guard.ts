import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { supabase } from '../core/supabase.client';

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);

  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (u && !u.is_anonymous) return true;
  router.navigate(['/admin/login']);
  return false;
};
