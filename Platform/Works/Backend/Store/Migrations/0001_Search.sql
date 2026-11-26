CREATE VIRTUAL TABLE `SearchPosts` USING fts5(Title, Body, content='Posts', content_rowid='rowid', tokenize='porter unicode61', prefix='2 3');
--> statement-breakpoint
CREATE TRIGGER `PostsIndexed` AFTER INSERT ON `Posts` BEGIN
  INSERT INTO `SearchPosts`(rowid, Title, Body) VALUES (new.rowid, new.Title, new.Body);
END;
--> statement-breakpoint
CREATE TRIGGER `PostsUnindexed` AFTER DELETE ON `Posts` BEGIN
  INSERT INTO `SearchPosts`(`SearchPosts`, rowid, Title, Body) VALUES ('delete', old.rowid, old.Title, old.Body);
END;
--> statement-breakpoint
CREATE TRIGGER `PostsReindexed` AFTER UPDATE OF Title, Body ON `Posts` BEGIN
  INSERT INTO `SearchPosts`(`SearchPosts`, rowid, Title, Body) VALUES ('delete', old.rowid, old.Title, old.Body);
  INSERT INTO `SearchPosts`(rowid, Title, Body) VALUES (new.rowid, new.Title, new.Body);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE `SearchUsers` USING fts5(Username, Display, Bio, content='Users', content_rowid='rowid', tokenize='porter unicode61', prefix='2 3');
--> statement-breakpoint
CREATE TRIGGER `UsersIndexed` AFTER INSERT ON `Users` BEGIN
  INSERT INTO `SearchUsers`(rowid, Username, Display, Bio) VALUES (new.rowid, new.Username, new.Display, new.Bio);
END;
--> statement-breakpoint
CREATE TRIGGER `UsersUnindexed` AFTER DELETE ON `Users` BEGIN
  INSERT INTO `SearchUsers`(`SearchUsers`, rowid, Username, Display, Bio) VALUES ('delete', old.rowid, old.Username, old.Display, old.Bio);
END;
--> statement-breakpoint
CREATE TRIGGER `UsersReindexed` AFTER UPDATE OF Username, Display, Bio ON `Users` BEGIN
  INSERT INTO `SearchUsers`(`SearchUsers`, rowid, Username, Display, Bio) VALUES ('delete', old.rowid, old.Username, old.Display, old.Bio);
  INSERT INTO `SearchUsers`(rowid, Username, Display, Bio) VALUES (new.rowid, new.Username, new.Display, new.Bio);
END;
