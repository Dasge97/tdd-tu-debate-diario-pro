SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS votes;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS friends;
DROP TABLE IF EXISTS user_notifications;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_conversations;
DROP TABLE IF EXISTS favorites;
DROP TABLE IF EXISTS generation_job_news;
DROP TABLE IF EXISTS news_items;
DROP TABLE IF EXISTS generation_jobs;
DROP TABLE IF EXISTS news_imports;
DROP TABLE IF EXISTS activity_events;
DROP TABLE IF EXISTS revoked_tokens;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS debates;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  bio VARCHAR(280) NULL,
  avatar_url VARCHAR(255) NULL,
  location VARCHAR(120) NULL,
  profile_tagline VARCHAR(160) NULL,
  profile_traits_json JSON NULL,
  reliability_score INT NOT NULL DEFAULT 0,
  role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  status ENUM('active', 'suspended') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE debates (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  question VARCHAR(255) NULL,
  card_summary TEXT NULL,
  context TEXT NOT NULL,
  category VARCHAR(80) NULL,
  source_name VARCHAR(255) NULL,
  source_url VARCHAR(1024) NULL,
  published_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  day_date DATE NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  author_type ENUM('ai', 'user') NOT NULL DEFAULT 'ai',
  ai_persona_name VARCHAR(120) NULL,
  ai_persona_label VARCHAR(160) NULL,
  ai_persona_bio VARCHAR(255) NULL,
  ai_persona_focus VARCHAR(180) NULL,
  ai_persona_traits_json JSON NULL,
  generation_job_id CHAR(36) NULL,
  news_item_id CHAR(36) NULL,
  generation_source VARCHAR(80) NULL,
  generation_model VARCHAR(180) NULL,
  raw_generation JSON NULL,
  PRIMARY KEY (id),
  KEY idx_debates_day_date (day_date),
  KEY idx_debates_generation_job_id (generation_job_id),
  CONSTRAINT fk_debates_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  debate_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  parent_id BIGINT UNSIGNED NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  score INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_comments_debate_id (debate_id),
  KEY idx_comments_parent_id (parent_id),
  CONSTRAINT fk_comments_debate
    FOREIGN KEY (debate_id) REFERENCES debates(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent
    FOREIGN KEY (parent_id) REFERENCES comments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  activity_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  debate_id BIGINT UNSIGNED NULL,
  comment_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_events_created_at (created_at),
  KEY idx_activity_events_user_created (user_id, created_at),
  KEY idx_activity_events_type_created (activity_type, created_at),
  KEY idx_activity_events_debate_created (debate_id, created_at),
  CONSTRAINT fk_activity_events_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_activity_events_debate
    FOREIGN KEY (debate_id) REFERENCES debates(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_activity_events_comment
    FOREIGN KEY (comment_id) REFERENCES comments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE votes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  comment_id BIGINT UNSIGNED NOT NULL,
  value TINYINT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_votes_user_comment (user_id, comment_id),
  CONSTRAINT fk_votes_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_votes_comment
    FOREIGN KEY (comment_id) REFERENCES comments(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE positions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  debate_id BIGINT UNSIGNED NOT NULL,
  position ENUM('support', 'oppose', 'neutral') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_positions_user_debate (user_id, debate_id),
  KEY idx_positions_debate_id (debate_id),
  CONSTRAINT fk_positions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_positions_debate
    FOREIGN KEY (debate_id) REFERENCES debates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE revoked_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_jti VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_revoked_tokens_jti (token_jti),
  KEY idx_revoked_tokens_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE favorites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  debate_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_favorites_user_debate (user_id, debate_id),
  KEY idx_favorites_user_created_at (user_id, created_at),
  CONSTRAINT fk_favorites_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_favorites_debate
    FOREIGN KEY (debate_id) REFERENCES debates(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE friends (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  requester_id BIGINT UNSIGNED NOT NULL,
  addressee_id BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_friends_directional (requester_id, addressee_id),
  KEY idx_friends_status_addressee (status, addressee_id),
  KEY idx_friends_status_requester (status, requester_id),
  CONSTRAINT fk_friends_requester
    FOREIGN KEY (requester_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_friends_addressee
    FOREIGN KEY (addressee_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_conversations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dm_key VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chat_conversations_dm_key (dm_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_messages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  conversation_id BIGINT UNSIGNED NOT NULL,
  sender_id BIGINT UNSIGNED NOT NULL,
  content TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_messages_conversation_id (conversation_id, id),
  CONSTRAINT fk_chat_messages_conversation
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chat_messages_sender
    FOREIGN KEY (sender_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE chat_participants (
  conversation_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_message_id BIGINT UNSIGNED NULL,
  last_read_at DATETIME NULL,
  PRIMARY KEY (conversation_id, user_id),
  KEY idx_chat_participants_user (user_id),
  CONSTRAINT fk_chat_participants_conversation
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_chat_participants_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(255) NOT NULL,
  data_json JSON NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_user_notifications_user_read_created (user_id, is_read, created_at),
  CONSTRAINT fk_user_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  action_type VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  payload_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_logs_created (created_at),
  KEY idx_admin_audit_logs_admin (admin_user_id),
  CONSTRAINT fk_admin_audit_logs_admin
    FOREIGN KEY (admin_user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news_imports (
  id CHAR(36) NOT NULL,
  trigger_type VARCHAR(100) NOT NULL,
  item_count INT NOT NULL DEFAULT 0,
  raw_payload JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_news_imports_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE generation_jobs (
  id CHAR(36) NOT NULL,
  source_import_id CHAR(36) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'awaiting-output',
  requested_news_count INT NOT NULL DEFAULT 0,
  selected_news_count INT NOT NULL DEFAULT 0,
  target_debates INT NOT NULL DEFAULT 5,
  prompt_file_path VARCHAR(1024) NULL,
  result_file_path VARCHAR(1024) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  applied_at DATETIME NULL,
  error_message TEXT NULL,
  meta JSON NULL,
  PRIMARY KEY (id),
  KEY idx_generation_jobs_created_at (created_at),
  KEY idx_generation_jobs_status (status),
  CONSTRAINT fk_generation_jobs_import
    FOREIGN KEY (source_import_id) REFERENCES news_imports(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE news_items (
  id CHAR(36) NOT NULL,
  import_id CHAR(36) NOT NULL,
  source_name VARCHAR(255) NOT NULL,
  source_key VARCHAR(255) NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  url VARCHAR(1024) NOT NULL,
  category VARCHAR(80) NULL,
  published_at DATETIME NULL,
  content LONGTEXT NULL,
  metadata JSON NULL,
  assigned_generation_job_id CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_news_items_import_id (import_id),
  KEY idx_news_items_assigned_generation_job_id (assigned_generation_job_id),
  KEY idx_news_items_published_at (published_at),
  CONSTRAINT fk_news_items_import
    FOREIGN KEY (import_id) REFERENCES news_imports(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_news_items_assigned_job
    FOREIGN KEY (assigned_generation_job_id) REFERENCES generation_jobs(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE generation_job_news (
  job_id CHAR(36) NOT NULL,
  news_id CHAR(36) NOT NULL,
  position INT NOT NULL,
  PRIMARY KEY (job_id, news_id),
  KEY idx_generation_job_news_position (job_id, position),
  CONSTRAINT fk_generation_job_news_job
    FOREIGN KEY (job_id) REFERENCES generation_jobs(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_generation_job_news_news
    FOREIGN KEY (news_id) REFERENCES news_items(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (username, email, password_hash, bio, location, profile_tagline, profile_traits_json, reliability_score, role, status) VALUES
('ana_debate', 'ana@example.com', '$2a$10$Y3MyZqpOEzByo7CPG1n5LewMbg4RWRJny8.1ThLriuzZnx1N.EsP6', 'Analizo debates de tecnología y trabajo.', 'Madrid', 'Analista de tecnología y trabajo', JSON_ARRAY('analítica', 'didáctica', 'ordenada'), 94, 'admin', 'active'),
('carlos_opinion', 'carlos@example.com', '$2a$10$YtgjFbB6a1I5JFr83tznFunEpPli71cVZk2QL5gbW9u9CsVk5oq9u', 'Me interesa política pública y ciudad.', 'Valencia', 'Observador de política urbana', JSON_ARRAY('directo', 'crítico', 'práctico'), 91, 'user', 'active'),
('maria_criterio', 'maria@example.com', '$2a$10$mxnbiYW/.v45fn8kRHSh0ud5zhZjvdShxBCu3iPr8jfrxtSa/ISru', 'Debato sobre energía y economía.', 'Barcelona', 'Perfil de energía y economía', JSON_ARRAY('sintética', 'rigurosa', 'comparativa'), 89, 'user', 'active');

INSERT INTO debates (title, context, day_date, created_by, author_type, ai_persona_name, ai_persona_label, ai_persona_bio, ai_persona_focus, ai_persona_traits_json) VALUES
(
  '¿Es viable la jornada laboral de 4 días?',
  'Cada vez más empresas prueban semanas laborales reducidas y reportan mejoras en productividad y bienestar, aunque persisten dudas sobre su aplicación en sectores con turnos continuos.',
  CURDATE(),
  NULL,
  'ai',
  'Clara Editorial',
  'Observadora de trabajo y empresa',
  'Analiza cambios en cultura laboral, productividad y bienestar con un tono sereno y estructurado.',
  'Le interesa cómo cambian el empleo, la empresa y la organización del tiempo.',
  JSON_ARRAY('serena', 'contextual', 'orientada a productividad')
),
(
  '¿La IA reemplazará a los programadores?',
  'Las herramientas de asistencia con IA aceleran tareas de desarrollo, pero el debate sigue abierto sobre si sustituyen empleo o si transforman el perfil técnico requerido.',
  CURDATE(),
  NULL,
  'ai',
  'Marco Señal',
  'Analista de tecnología aplicada',
  'Suele plantear debates donde innovación, empleo y responsabilidad técnica chocan entre sí.',
  'Cruza innovación, impacto profesional y responsabilidad tecnológica.',
  JSON_ARRAY('técnico', 'crítico', 'anticipatorio')
),
(
  '¿Debe limitarse Airbnb en grandes ciudades?',
  'Distintas ciudades estudian límites al alquiler turístico para aliviar la presión sobre el mercado residencial y reducir el encarecimiento del alquiler de larga duración.',
  CURDATE(),
  NULL,
  'ai',
  'Sofía Plaza',
  'Editora de ciudad y vivienda',
  'Observa el impacto urbano de las plataformas y cómo cambian la vida cotidiana en los barrios.',
  'Sigue temas de vivienda, ciudad y tensiones entre mercado y vecindad.',
  JSON_ARRAY('urbana', 'cívica', 'equilibrada')
),
(
  '¿Es necesaria la energía nuclear para la transición energética?',
  'En plena descarbonización, algunos expertos defienden la nuclear como soporte estable de la red, mientras otros cuestionan sus costes y gestión de residuos.',
  CURDATE(),
  NULL,
  'ai',
  'Irene Vector',
  'Curadora de energía y clima',
  'Construye debates donde seguridad, coste, estabilidad de red y sostenibilidad compiten en la misma conversación.',
  'Se centra en transición energética, fiabilidad del sistema y coste político.',
  JSON_ARRAY('técnica', 'sistémica', 'comparativa')
),
(
  '¿Deben regularse las redes sociales?',
  'La discusión enfrenta protección frente a desinformación y riesgos en salud mental con la necesidad de preservar la libertad de expresión y la innovación digital.',
  CURDATE(),
  NULL,
  'ai',
  'Nora Prisma',
  'Observadora de cultura digital',
  'Formula preguntas sobre libertad, plataformas y convivencia online desde una mirada cívica.',
  'Explora cómo las plataformas alteran la conversación pública y la convivencia digital.',
  JSON_ARRAY('cultural', 'cívica', 'reflexiva')
);

INSERT INTO debates (
  title,
  question,
  card_summary,
  context,
  category,
  source_url,
  day_date,
  created_by,
  author_type,
  generation_source,
  raw_generation
) VALUES (
  '¿Deberían prohibirse los móviles en todo el horario escolar?',
  '¿Tiene sentido limitar completamente el uso del móvil en los centros educativos?',
  'Cada vez más centros revisan el uso del móvil en clase y recreos, y el debate real es si mejora la convivencia o si traslada el problema a otros espacios.',
  'Muchos colegios e institutos están endureciendo sus normas sobre teléfonos móviles por su impacto en la atención, la convivencia y el acoso. La discusión ya no gira solo sobre si distraen en clase, sino sobre qué tipo de hábitos digitales se quieren fomentar dentro y fuera del aula. Para algunos, la prohibición completa simplifica las normas y protege mejor a los menores. Para otros, educar en el uso responsable es más útil que retirar el dispositivo por completo.',
  'sociedad',
  'https://example.com/moviles-escuela',
  CURDATE(),
  2,
  'user',
  'user-form',
  JSON_OBJECT('createdFrom', 'seed')
);

INSERT INTO comments (debate_id, user_id, parent_id, content, score) VALUES
(1, 1, NULL, 'Creo que es viable en sectores de oficina si se mide por objetivos.', 12),
(1, 2, NULL, 'Sin cambios en procesos, reducir días puede generar cuellos de botella.', 7),
(2, 3, NULL, 'La IA ayuda mucho, pero todavía necesita supervisión experta.', 15),
(2, 1, 3, 'Totalmente de acuerdo: acelera, pero no reemplaza criterio técnico.', 5),
(5, 2, NULL, 'Regular sí, pero con límites claros para no censurar debate legítimo.', 9),
(4, 3, NULL, 'Sin almacenamiento serio y plazos realistas, la nuclear no puede evaluarse solo por emisiones.', 3),
(1, 1, NULL, 'En pymes pequeñas puede funcionar, pero hace falta rediseñar reuniones y objetivos.', 2),
(4, 2, 6, 'Ese es el punto clave: no basta con producir, también hay que asumir costes de seguridad y residuos.', 1);

INSERT INTO votes (user_id, comment_id, value) VALUES
(2, 1, 1),
(3, 1, 1),
(1, 3, 1),
(2, 3, 1),
(3, 5, 1),
(1, 6, 1),
(2, 6, -1),
(3, 7, 1),
(1, 8, 1);

INSERT INTO positions (user_id, debate_id, position) VALUES
(1, 1, 'support'),
(2, 1, 'oppose'),
(3, 1, 'neutral'),
(1, 2, 'neutral'),
(2, 2, 'oppose'),
(3, 2, 'support'),
(1, 3, 'support'),
(2, 3, 'neutral'),
(3, 3, 'support'),
(1, 4, 'support'),
(2, 4, 'oppose'),
(3, 4, 'neutral'),
(1, 5, 'support'),
(2, 5, 'support'),
(3, 5, 'neutral');

INSERT INTO favorites (user_id, debate_id) VALUES
(1, 2),
(1, 5),
(2, 1),
(3, 4);

INSERT INTO friends (requester_id, addressee_id, status, responded_at) VALUES
(1, 2, 'accepted', NOW()),
(2, 3, 'pending', NULL);

INSERT INTO chat_conversations (dm_key) VALUES
('1:2');

INSERT INTO chat_participants (conversation_id, user_id, last_read_message_id, last_read_at) VALUES
(1, 1, NULL, NULL),
(1, 2, NULL, NULL);

INSERT INTO chat_messages (conversation_id, sender_id, content) VALUES
(1, 1, 'Hola Carlos, ¿qué opinas del debate de la jornada de 4 días?'),
(1, 2, 'Lo veo interesante, pero dependerá mucho del tipo de empresa.');

INSERT INTO activity_events (user_id, activity_type, entity_type, entity_id, debate_id, comment_id, metadata_json, created_at) VALUES
(2, 'debate_created', 'debate', 6, 6, NULL, JSON_OBJECT('category', 'sociedad', 'sourceUrl', 'https://example.com/moviles-escuela'), NOW() - INTERVAL 4 HOUR),
(3, 'comment_created', 'comment', 6, 4, 6, JSON_OBJECT('parentId', NULL), NOW() - INTERVAL 3 HOUR),
(1, 'comment_created', 'comment', 7, 1, 7, JSON_OBJECT('parentId', NULL), NOW() - INTERVAL 2 HOUR),
(2, 'comment_replied', 'comment', 8, 4, 8, JSON_OBJECT('parentId', 6), NOW() - INTERVAL 105 MINUTE),
(1, 'comment_voted', 'comment', 6, 4, 6, JSON_OBJECT('value', 1, 'previousValue', 0), NOW() - INTERVAL 70 MINUTE),
(2, 'comment_voted', 'comment', 6, 4, 6, JSON_OBJECT('value', -1, 'previousValue', 0), NOW() - INTERVAL 55 MINUTE),
(3, 'comment_voted', 'comment', 7, 1, 7, JSON_OBJECT('value', 1, 'previousValue', 0), NOW() - INTERVAL 40 MINUTE),
(1, 'position_set', 'position', 1, 1, NULL, JSON_OBJECT('previousPosition', NULL, 'position', 'support'), NOW() - INTERVAL 20 MINUTE),
(2, 'position_changed', 'position', 10, 4, NULL, JSON_OBJECT('previousPosition', 'neutral', 'position', 'oppose'), NOW() - INTERVAL 10 MINUTE);
