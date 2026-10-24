-- Widen tokens for their unique JWT ID; existing tokens remain valid.
ALTER TABLE `RefreshToken` MODIFY `token` VARCHAR(512) NOT NULL;

-- Reject repeated registrations, including simultaneous requests.
CREATE UNIQUE INDEX `EventRegistration_userId_eventId_key`
ON `EventRegistration`(`userId`, `eventId`);
