<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Service\AdminService;
use App\Service\Editorial\EditorialAdminService;
use App\Service\Editorial\EditorialConfig;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

/** Motor editorial V2 en el panel: configuración, ejecuciones, uso y fuentes. */
#[Route('/admin/editorial')]
class AdminEditorialController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly AdminService $adminService,
        private readonly EditorialAdminService $editorial,
        private readonly EditorialConfig $config,
    ) {
    }

    private function admin(Request $request): ?User
    {
        $id = $request->getSession()->get('admin_user_id');
        $user = $id !== null ? $this->users->find($id) : null;
        return ($user !== null && $user->getRole() === 'admin') ? $user : null;
    }

    #[Route('', name: 'admin_editorial', methods: ['GET'])]
    public function index(Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        return $this->render('admin/editorial/index.html.twig', [
            'admin'    => $admin,
            'config'   => $this->config->entity(),
            'limits'   => $this->config->limits(),
            'defaults' => EditorialConfig::DEFAULT_LIMITS,
            'billing'  => $this->config->billing(),
            'keyHint'  => $this->config->hasApiKey() ? $this->safeHint() : null,
            'runs'     => $this->editorial->recentRuns(20),
            'saved'    => $request->query->get('guardado') === '1',
        ]);
    }

    private function safeHint(): string
    {
        try {
            return $this->config->apiKeyHint() ?? '';
        } catch (\RuntimeException) {
            return 'no se puede descifrar: vuelve a guardarla';
        }
    }

    #[Route('/config', name: 'admin_editorial_config', methods: ['POST'])]
    public function saveConfig(Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        $input = $request->request->all();
        $this->editorial->updateConfig($input);

        // En la auditoría no se guarda la clave, solo si se cambió.
        $audit = $input;
        $audit['llmApiKey'] = ($input['llmApiKey'] ?? '') !== '' ? '(cambiada)' : '(sin cambios)';
        $this->adminService->logAction($admin, 'update_editorial_config', 'WorkerConfig', 1, $audit);

        return new RedirectResponse('/admin/editorial?guardado=1');
    }

    #[Route('/runs/{id}', name: 'admin_editorial_run', methods: ['GET'])]
    public function run(string $id, Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        return $this->render('admin/editorial/run.html.twig', [
            'admin'  => $admin,
            'detail' => $this->editorial->runDetail($id),
        ]);
    }

    #[Route('/uso', name: 'admin_editorial_usage', methods: ['GET'])]
    public function usage(Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        return $this->render('admin/editorial/usage.html.twig', [
            'admin' => $admin,
            'usage' => $this->editorial->usageByDay(30),
            'model' => $this->config->entity()->getLlmModel(),
        ]);
    }

    #[Route('/fuentes', name: 'admin_editorial_sources', methods: ['GET'])]
    public function sources(Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        return $this->render('admin/editorial/sources.html.twig', [
            'admin'   => $admin,
            'sources' => $this->editorial->sources(),
            'error'   => $request->query->get('error'),
        ]);
    }

    #[Route('/fuentes/{id}/toggle', name: 'admin_editorial_source_toggle', methods: ['POST'], requirements: ['id' => '\d+'])]
    public function toggleSource(int $id, Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        $source = $this->editorial->toggleSource($id);
        if ($source !== null) {
            $this->adminService->logAction($admin, 'toggle_editorial_source', 'EditorialSource', $id, ['enabled' => $source->isEnabled()]);
        }
        return new RedirectResponse('/admin/editorial/fuentes');
    }

    #[Route('/fuentes', name: 'admin_editorial_source_add', methods: ['POST'])]
    public function addSource(Request $request): Response
    {
        if (!$admin = $this->admin($request)) { return new RedirectResponse('/admin/login'); }

        try {
            $source = $this->editorial->addSource($request->request->all());
            $this->adminService->logAction($admin, 'add_editorial_source', 'EditorialSource', (int) $source->getId(), ['url' => $source->getUrl()]);
        } catch (\InvalidArgumentException $e) {
            return new RedirectResponse('/admin/editorial/fuentes?error=' . rawurlencode($e->getMessage()));
        }
        return new RedirectResponse('/admin/editorial/fuentes');
    }
}
