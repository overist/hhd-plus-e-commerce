-- COUPON DATA
INSERT INTO coupons (name, discount_rate, total_quantity, issued_quantity, expired_at)
    VALUES ('TESTCOUPON', 15, 10000, 0, '2029-12-31 23:59:59');

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- SAMPLE USERS (5명)
INSERT INTO users (balance) VALUES
    (100000),    -- user_id: 1 - 잔액 10만원
    (50000),     -- user_id: 2 - 잔액 5만원
    (200000),    -- user_id: 3 - 잔액 20만원
    (0),         -- user_id: 4 - 잔액 0원
    (500000);    -- user_id: 5 - 잔액 50만원

-- SAMPLE PRODUCTS (10개)
INSERT INTO products (name, description, price, category, is_available) VALUES
    ('나이키 에어맥스', '편안한 러닝화', 159000, 'SHOES', TRUE),           -- product_id: 1
    ('아디다스 울트라부스트', '프리미엄 러닝화', 189000, 'SHOES', TRUE),   -- product_id: 2
    ('폴로 라운드티', '베이직 반팔 티셔츠', 49000, 'CLOTHING', TRUE),      -- product_id: 3
    ('리바이스 501', '클래식 데님 청바지', 99000, 'CLOTHING', TRUE),       -- product_id: 4
    ('애플 에어팟 프로', '노이즈 캔슬링 이어폰', 329000, 'ELECTRONICS', TRUE),  -- product_id: 5
    ('삼성 갤럭시 버즈', '무선 이어폰', 179000, 'ELECTRONICS', TRUE),      -- product_id: 6
    ('노스페이스 패딩', '겨울 다운 자켓', 299000, 'CLOTHING', TRUE),       -- product_id: 7
    ('언더아머 반바지', '스포츠 반바지', 45000, 'CLOTHING', TRUE),         -- product_id: 8
    ('뉴발란스 993', '클래식 운동화', 259000, 'SHOES', TRUE),              -- product_id: 9
    ('컨버스 척테일러', '캔버스 스니커즈', 75000, 'SHOES', FALSE);         -- product_id: 10 (판매 중지)

-- SAMPLE PRODUCT OPTIONS (각 상품당 2-3개 옵션)
INSERT INTO product_options (product_id, color, size, stock, reserved_stock) VALUES
    -- 나이키 에어맥스 옵션
    (1, 'WHITE', '270', 100000, 0),     -- option_id: 1
    (1, 'BLACK', '270', 100000, 0),     -- option_id: 2
    (1, 'WHITE', '280', 100000, 0),     -- option_id: 3
    -- 아디다스 울트라부스트 옵션
    (2, 'GRAY', '265', 100000, 0),      -- option_id: 4
    (2, 'NAVY', '270', 100000, 0),      -- option_id: 5
    -- 폴로 라운드티 옵션
    (3, 'WHITE', 'M', 100000, 0),      -- option_id: 6
    (3, 'WHITE', 'L', 100000, 0),       -- option_id: 7
    (3, 'NAVY', 'M', 100000, 0),        -- option_id: 8
    -- 리바이스 501 옵션
    (4, 'BLUE', '32', 100000, 0),       -- option_id: 9
    (4, 'BLUE', '34', 100000, 0),       -- option_id: 10
    -- 애플 에어팟 프로 옵션
    (5, 'WHITE', 'ONE', 100000, 0),    -- option_id: 11
    -- 삼성 갤럭시 버즈 옵션
    (6, 'BLACK', 'ONE', 100000, 0),     -- option_id: 12
    (6, 'WHITE', 'ONE', 100000, 0),     -- option_id: 13
    -- 노스페이스 패딩 옵션
    (7, 'BLACK', 'M', 100000, 0),       -- option_id: 14
    (7, 'BLACK', 'L', 100000, 0),       -- option_id: 15
    (7, 'NAVY', 'M', 100000, 0),        -- option_id: 16
    -- 언더아머 반바지 옵션
    (8, 'BLACK', 'M', 100000, 0),       -- option_id: 17
    (8, 'GRAY', 'L', 100000, 0),        -- option_id: 18
    -- 뉴발란스 993 옵션
    (9, 'GRAY', '270', 100000, 0),      -- option_id: 19
    (9, 'GRAY', '280', 100000, 0),      -- option_id: 20
    -- 컨버스 척테일러 옵션 (판매 중지 상품)
    (10, 'BLACK', '260', 0, 0);     -- option_id: 21

-- SAMPLE ORDERS (결제 완료된 주문들 - 인기상품 통계용)
INSERT INTO orders (user_id, coupon_id, total_amount, discount_amount, final_amount, status, created_at, paid_at, expired_at) VALUES
    -- 최근 3일 내 주문들 (인기상품 집계 대상)
    (1, NULL, 159000, 0, 159000, 'PAID', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 4 DAY),   -- order_id: 1
    (2, NULL, 318000, 0, 318000, 'PAID', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 4 DAY),   -- order_id: 2
    (3, NULL, 329000, 0, 329000, 'PAID', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY),   -- order_id: 3
    (1, NULL, 658000, 0, 658000, 'PAID', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY),   -- order_id: 4
    (5, NULL, 189000, 0, 189000, 'PAID', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 2 DAY),   -- order_id: 5
    (2, NULL, 99000, 0, 99000, 'PAID', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 4 DAY),     -- order_id: 6
    (3, NULL, 49000, 0, 49000, 'PAID', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY),     -- order_id: 7
    (1, NULL, 329000, 0, 329000, 'PAID', NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 4 DAY),   -- order_id: 8
    (5, NULL, 179000, 0, 179000, 'PAID', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 3 DAY),   -- order_id: 9
    (4, NULL, 159000, 0, 159000, 'PAID', NOW() - INTERVAL 3 DAY, NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 2 DAY);   -- order_id: 10

-- SAMPLE ORDER ITEMS (주문 상세 - 인기상품 집계에 사용)
INSERT INTO order_items (order_id, product_option_id, product_name, price, quantity, subtotal) VALUES
    -- order 1: 나이키 에어맥스 1개
    (1, 1, '나이키 에어맥스', 159000, 1, 159000),
    -- order 2: 나이키 에어맥스 2개
    (2, 2, '나이키 에어맥스', 159000, 2, 318000),
    -- order 3: 애플 에어팟 프로 1개
    (3, 11, '애플 에어팟 프로', 329000, 1, 329000),
    -- order 4: 애플 에어팟 프로 2개
    (4, 11, '애플 에어팟 프로', 329000, 2, 658000),
    -- order 5: 아디다스 울트라부스트 1개
    (5, 4, '아디다스 울트라부스트', 189000, 1, 189000),
    -- order 6: 리바이스 501 1개
    (6, 9, '리바이스 501', 99000, 1, 99000),
    -- order 7: 폴로 라운드티 1개
    (7, 6, '폴로 라운드티', 49000, 1, 49000),
    -- order 8: 애플 에어팟 프로 1개
    (8, 11, '애플 에어팟 프로', 329000, 1, 329000),
    -- order 9: 삼성 갤럭시 버즈 1개
    (9, 12, '삼성 갤럭시 버즈', 179000, 1, 179000),
    -- order 10: 나이키 에어맥스 1개
    (10, 3, '나이키 에어맥스', 159000, 1, 159000);
