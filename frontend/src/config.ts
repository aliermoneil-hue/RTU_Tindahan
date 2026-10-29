/* Settings you can change in one place. */
export const config = {
  /* Web address of the full RTU Tindahan prototype, for example 'https://your-site.example/'.
     When this is filled in, Sign in and Create account open the prototype's own pages.
     When it is empty, they open the small demo pages inside this project. */
  appUrl: '',
  /* Contact email shown in the footer. Leave empty to show nothing. */
  contactEmail: '',
}

export type AuthMode = 'sign-in' | 'create-account'

export function authHref(mode: AuthMode): string {
  if (config.appUrl) return config.appUrl + (mode === 'sign-in' ? '#login' : '#verify')
  return mode === 'sign-in' ? '#/sign-in' : '#/create-account'
}
