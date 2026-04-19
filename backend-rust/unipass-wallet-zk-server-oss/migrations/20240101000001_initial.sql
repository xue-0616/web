-- EmailProofs table — verbatim column list from the closed-source ELF's rodata.
CREATE TABLE IF NOT EXISTS EmailProofs (
    header_hash          char(66)      NOT NULL PRIMARY KEY,
    email_type           int           NOT NULL,
    from_left_index      int           NOT NULL,
    from_len             int           NOT NULL,
    success              boolean       NOT NULL,
    public_inputs_num    char(34)      NOT NULL,
    domain_size          char(34)      NOT NULL,
    header_pub_match     varchar(4098) NOT NULL,
    public_inputs        varchar(2048) NOT NULL,
    proof                varchar(4096) NOT NULL,
    failed_reason        varchar(2048) NOT NULL DEFAULT ''
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
