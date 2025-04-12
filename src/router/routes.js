const routes = [
  {
    path: '',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      {
        path: '/map',
        component: () => import('pages/IndexPage.vue'),
        name: 'HomePage',
      },
      {
        path: 'user-management',
        component: () => import('pages/UserManagementPage.vue'),
        meta: {
          authRequired: true,
        },
      },
      { path: 'profile', component: () => import('pages/ProfilePage/index.vue') },
    ],
  },
  {
    path: '/login',
    component: () => import('pages/LoginPage/index.vue'),
    name: 'LoginPage',
    meta: {
      public: true,
    },
  },
  {
    path: '/register',
    component: () => import('pages/LoginPage/RegisterPage.vue'),
    name: 'RegisterPage',
    meta: {
      public: true,
    },
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes
