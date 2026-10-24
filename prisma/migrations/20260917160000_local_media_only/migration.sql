-- Replace remote media references without deleting any records or local uploads.
UPDATE `Report` SET `media` = '/images/placeholder.svg'
WHERE `media` REGEXP '^(https?:)?//';

UPDATE `News` SET `image` = '/images/placeholder.svg'
WHERE `image` REGEXP '^(https?:)?//';

UPDATE `Event` SET `image` = '/images/placeholder.svg'
WHERE `image` REGEXP '^(https?:)?//';
