<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Gmail / SMTP transport for AssignmentNotification mail
    |--------------------------------------------------------------------------
    |
    | Configuración dedicada para el envío de mail de notificación de
    | asignación de operador a una incidencia. Si los valores GMAIL_*
    | no están seteados en el entorno, el servicio SmtpMailSender hace
    | fallback automático a config('mail.*') (vars MAIL_*), garantizando
    | que el mail siga saliendo incluso sin env dedicado.
    |
    | Orden de precedencia que SmtpMailSender aplica:
    |
    |   1. config('gmail.from_address')  →  si no vacío
    |   2. config('mail.from.address')   →  fallback
    |
    |   1. config('gmail.from_name')     →  si no vacío
    |   2. config('mail.from.name')      →  fallback
    |
    | Las credenciales (host/port/username/password/encryption) NO se
    | leen desde aquí: el mailer real las consume de la sección
    | `mail.mailers.smtp` de config/mail.php (que ya está poblada por
    | MAIL_HOST/MAIL_PORT/etc.). Esta sección expone SOLO el from y el
    | "identifier" del canal (usado para logs y debugging).
    */

    'mail_host' => env('GMAIL_MAIL_HOST', 'smtp.gmail.com'),

    'mail_port' => (int) env('GMAIL_MAIL_PORT', 587),

    'mail_username' => env('GMAIL_MAIL_USERNAME'),

    'mail_password' => env('GMAIL_MAIL_PASSWORD'),

    'mail_encryption' => env('GMAIL_MAIL_ENCRYPTION', 'tls'),

    'from_address' => env('GMAIL_FROM_ADDRESS'),

    'from_name' => env('GMAIL_FROM_NAME'),
];
